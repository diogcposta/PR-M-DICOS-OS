import { beforeEach, describe, expect, it } from "vitest";

import { Api, dispatch, type Env } from "../../apps-script/src/server/api";
import { decodeCell, encodeCell, SheetDb, type SpreadsheetLike } from "../../apps-script/src/server/sheets";
import { TABLES } from "../../apps-script/src/server/tables";
import { FakeSpreadsheet } from "../../apps-script/src/preview/fake-sheets";
import { buildState } from "../../apps-script/src/client/state";
import { exportCsv } from "../../apps-script/src/client/views/manage";
import { applyClosings, monthFees } from "@/modules/production/domain/closing";
import { examTotals } from "@/modules/production/domain/exams";
import { dashboardView, monthlySeries, profitabilityView } from "@/modules/production/domain/views";

let spreadsheet: FakeSpreadsheet;
let env: Env;
let ids = 0;

beforeEach(() => {
  spreadsheet = new FakeSpreadsheet();
  ids = 0;
  env = {
    spreadsheet,
    spreadsheetUrl: () => "https://docs.google.com/spreadsheets/d/teste",
    newId: () => `id-${++ids}`,
    today: () => "2026-09-26",
    nowIso: () => `2026-09-26T10:00:${String(ids).padStart(2, "0")}Z`,
    withLock: (fn) => fn(),
  };
});

const call = (name: string, ...args: unknown[]) => JSON.parse(dispatch(env, name, args));

describe("folha Google Sheets", () => {
  it("configurar cria os separadores com cabeçalhos em português e o perfil inicial", () => {
    const created = new Api(env).setup();
    expect(created).toEqual(Object.values(TABLES).map((t) => t.name));
    expect(spreadsheet.getSheetByName("Procedimentos")!.rows[0]).toContain("valor_faturado_cent");
    const data = call("getData").data;
    expect(data.profile.name).toBe("Diogo Costa");
    expect(data.profile.feeBps).toBe(5000);
    expect(data.goals.map((g: { centsPerHour: number }) => g.centsPerHour)).toEqual([8500, 10000, 12500, 15000]);
    expect(new Api(env).setup()).toEqual([]); // idempotente
  });

  it("horas, datas e sim/não ficam legíveis na folha e voltam iguais", () => {
    const col = (type: "time" | "date" | "bool") => ({ field: "x", header: "x", type });
    expect(encodeCell(570, col("time"))).toBe("09:30");
    expect(decodeCell("09:30", col("time"))).toBe(570);
    expect(decodeCell(new Date(2026, 8, 2), col("date"))).toBe("2026-09-02"); // se o Sheets converter em data
    expect(decodeCell("02/09/2026", col("date"))).toBe("2026-09-02");
    expect(encodeCell(true, col("bool"))).toBe("sim");
    expect(decodeCell("não", col("bool"))).toBe(false);
  });

  it("recusa folhas com cabeçalhos alterados, com mensagem clara", () => {
    new Api(env).setup();
    spreadsheet.getSheetByName("Dias")!.rows[0]![1] = "Data (alterado)";
    expect(() => new SheetDb(spreadsheet).read("days")).toThrow(/não tem as colunas: data/);
  });
});

describe("operações", () => {
  const procedure = {
    date: "2026-09-02",
    procedureType: "Coroa cerâmica",
    category: "Coroa",
    billed: "600",
    plannedVisits: "3",
    start: "09:30",
    end: "11:00",
    caseCode: "dc-2026-001",
    completed: "on",
  };

  it("coroa em 3 consultas: uma receita, 3 h, €200/h (mesmos cálculos da app Next)", () => {
    call("saveDay", { date: "2026-09-02", start: "09:30", end: "19:00", breakMinutes: "120" });
    const created = call("createProcedure", procedure);
    expect(created.ok).toBe(true);
    const id = created.data.procedures[0].id;
    expect(call("addSession", id, { date: "2026-09-09", start: "09:30", end: "10:15" }).ok).toBe(true);
    const last = call("addSession", id, { date: "2026-09-16", start: "09:30", end: "10:15" });
    const state = buildState(last.data);
    const p = profitabilityView(state.procedures, state.profile, state.goals);
    expect(p.perProcedure[0]!.metrics.chairMinutes).toBe(180);
    expect(p.perProcedure[0]!.metrics.centsPerHour).toBe(20_000);
    expect(state.procedures[0]!.caseCode).toBe("DC-2026-001");
  });

  it("recusa consultas sobrepostas e erros de validação por campo", () => {
    call("createProcedure", procedure);
    const overlap = call("createProcedure", { ...procedure, procedureType: "Urgência", category: "Urgência", start: "10:00", end: "10:30", caseCode: "" });
    expect(overlap.ok).toBe(false);
    expect(overlap.message).toMatch(/Sobrepõe-se a outra consulta \(Coroa cerâmica, 09:30–11:00\)/);
    const invalid = call("createProcedure", { ...procedure, billed: "abc", caseCode: "Maria Silva" });
    expect(invalid.ok).toBe(false);
    expect(Object.keys(invalid.errors)).toEqual(expect.arrayContaining(["billed", "caseCode"]));
  });

  it("apagar um procedimento apaga as suas consultas", () => {
    const id = call("createProcedure", procedure).data.procedures[0].id;
    const after = call("deleteProcedure", id);
    expect(after.data.procedures).toHaveLength(0);
    expect(after.data.sessions).toHaveLength(0);
  });

  it("definições: percentagem, horário, objetivos e cenários", () => {
    const form: Record<string, string> = {
      name: "Diogo Costa", feePercent: "45", feeBase: "BILLED", standardSlotMinutes: "45", saturdayMinutes: "210", primaryGoal: "100",
      targetNoShowPercent: "5", followUpMin: "500", followUpPriority: "1500", followUpFirstAlertDays: "7", followUpSecondAlertDays: "30",
      s_1_0_start: "09:00", s_1_0_end: "13:00", g_0_label: "Meta", g_0_value: "90", c_0_name: "Atual", c_0_value: "", c_0_hours: "140",
    };
    const r = call("saveSettings", form);
    expect(r.ok).toBe(true);
    expect(r.data.profile.feeBps).toBe(4500);
    expect(r.data.schedule).toHaveLength(1);
    expect(r.data.goals.map((g: { centsPerHour: number }) => g.centsPerHour)).toEqual([9000]);
    expect(r.data.scenarios[0].centsPerHour).toBeNull();
    expect(call("saveSettings", { ...form, feePercent: "150" }).ok).toBe(false);
  });

  it("planos, follow-up e contacto registado", () => {
    const r = call("createPlan", { caseCode: "DC-2026-050", presentedDate: "2026-08-20", total: "2000", phases: "2", status: "PRESENTED" });
    const planId = r.data.plans[0].id;
    let state = buildState(r.data);
    let d = dashboardView(state.records, state.profile, state.goals, "2026-09", state.today);
    expect(d.followUps[0]).toMatchObject({ caseCode: "DC-2026-050", priority: "PRIORITY", alertLevel: 2 });
    state = buildState(call("markPlanContacted", planId).data);
    d = dashboardView(state.records, state.profile, state.goals, "2026-09", state.today);
    expect(d.followUps[0]!.alertLevel).toBe(0);
  });

  it("operação desconhecida é recusada", () => {
    expect(call("apagarTudo").ok).toBe(false);
  });
});

describe("demonstração no Sheets", () => {
  it("setembro de 2026: €8.619, €4.309,50, 130,5 h, ≈66,05 €/h", () => {
    const r = call("loadDemo");
    expect(r.ok).toBe(true);
    const state = buildState(r.data);
    const d = dashboardView(state.records, state.profile, state.goals, "2026-09", state.today);
    expect(d.current.productionCents).toBe(861_900);
    expect(d.current.feeCents).toBe(430_950);
    expect(d.current.clinicalMinutes).toBe(7_830);
    expect(d.current.centsPerHour! / 100).toBeCloseTo(66.05, 2);
    expect(d.gap?.diffCentsPerHour).toBeCloseTo(8_500 - 6_604.6, 0);
  });

  it("a exportação CSV é compatível com a importação da versão local", () => {
    const state = buildState(call("loadDemo").data);
    const csv = exportCsv(state, "procedimentos");
    expect(csv.startsWith("﻿id;data;case_id;procedimento")).toBe(true);
    expect(csv).toMatch(/02\/09\/2026 09:30-11:00\|09\/09\/2026 09:30-10:15/);
  });
});

describe("leitura em lote (serviço avançado Sheets)", () => {
  /** Como o Sheets.Values.batchGet: separadores inteiros, sem células vazias no fim das linhas. */
  function withBatchRead(s: FakeSpreadsheet) {
    const calls = { readTables: 0, getSheetByName: 0 };
    const sheet: SpreadsheetLike = {
      getSheetByName: (name) => (calls.getSheetByName++, s.getSheetByName(name)),
      insertSheet: (name) => s.insertSheet(name),
      readTables: (names) => {
        calls.readTables++;
        return names.map((name) => {
          const found = s.getSheetByName(name);
          if (!found) throw new Error(`Unable to parse range: '${name}'`);
          return found.rows.map((row) => {
            const cells = [...row];
            while (cells.length && (cells.at(-1) === "" || cells.at(-1) === null)) cells.pop();
            return cells;
          });
        });
      },
    };
    return { sheet, calls };
  }

  it("abrir a app lê todos os separadores numa só chamada, com os mesmos dados", () => {
    call("loadDemo");
    const expected = call("getData").data;
    const { sheet, calls } = withBatchRead(spreadsheet);
    const data = JSON.parse(dispatch({ ...env, spreadsheet: sheet }, "getData", [])).data;
    expect(data).toEqual(expected);
    expect(calls).toEqual({ readTables: 1, getSheetByName: 0 });
  });

  it("gravar lê uma vez e devolve os dados atualizados sem reler a folha", () => {
    new Api(env).setup();
    const { sheet, calls } = withBatchRead(spreadsheet);
    const r = JSON.parse(dispatch({ ...env, spreadsheet: sheet }, "createAbsence", [{ date: "2026-09-03", start: "10:00", durationMinutes: "45", kind: "NO_SHOW", estimatedValue: "60" }]));
    expect(r.ok).toBe(true);
    expect(r.data.absences).toHaveLength(1);
    expect(calls.readTables).toBe(1);
    expect(call("getData").data.absences).toEqual(r.data.absences); // gravado na folha
  });

  it("sem separadores (antes de configurar) volta à leitura normal e cria-os", () => {
    const { sheet, calls } = withBatchRead(spreadsheet);
    const data = JSON.parse(dispatch({ ...env, spreadsheet: sheet }, "getData", [])).data;
    expect(data.profile.name).toBe("Diogo Costa");
    expect(calls.readTables).toBe(1);
    expect(spreadsheet.getSheetByName("Procedimentos")).not.toBeNull();
  });

  it("horas lidas como texto formatado (\"9:30:00\")", () => {
    expect(decodeCell("9:30:00", { field: "x", header: "x", type: "time" })).toBe(570);
  });
});

describe("exames (ortopantomografia, CBCT…)", () => {
  it("honorários à mesma percentagem dos atos, fora da produção clínica e do €/hora", () => {
    call("saveDay", { date: "2026-09-02", start: "09:30", end: "19:00", breakMinutes: "120" });
    call("createProcedure", { date: "2026-09-02", procedureType: "Restauração", category: "Dentisteria", billed: "70", plannedVisits: "1", start: "09:30", end: "10:15" });
    const before = buildState(call("getData").data);
    const without = dashboardView(before.records, before.profile, before.goals, "2026-09", before.today).current;

    expect(call("createExam", { date: "2026-09-02", examType: "Ortopantomografia", billed: "30", caseCode: "dc-2026-001" }).ok).toBe(true);
    const r = call("createExam", { date: "2026-09-10", examType: "CBCT", billed: "80,50" });
    expect(r.ok).toBe(true);
    call("createExam", { date: "2026-08-31", examType: "CBCT", billed: "80" }); // outro mês

    const state = buildState(r.data);
    expect(state.exams.map((x) => [x.examType, x.billedCents, x.caseCode])).toEqual([
      ["Ortopantomografia", 3000, "DC-2026-001"],
      ["CBCT", 8050, null],
    ]);
    const t = examTotals(buildState(call("getData").data).exams, "2026-09-01", "2026-09-30", state.profile.feeBps);
    expect(t).toMatchObject({ count: 2, billedCents: 11_050, feeCents: 1_500 + 4_025 });
    expect(t.byType.map((x) => x.examType)).toEqual(["CBCT", "Ortopantomografia"]);

    const after = buildState(call("getData").data);
    const withExams = dashboardView(after.records, after.profile, after.goals, "2026-09", after.today).current;
    expect(withExams.productionCents).toBe(without.productionCents);
    expect(withExams.centsPerHour).toBe(without.centsPerHour);
  });

  it("um arredondamento ao cêntimo por exame e só dentro do período", () => {
    const exams = [
      { id: "a", date: "2026-09-01", examType: "CBCT", caseCode: null, billedCents: 1 },
      { id: "b", date: "2026-09-30", examType: "CBCT", caseCode: null, billedCents: 1 },
      { id: "c", date: "2026-10-01", examType: "CBCT", caseCode: null, billedCents: 10_000 },
    ];
    expect(examTotals(exams, "2026-09-01", "2026-09-30", 5000)).toMatchObject({ count: 2, billedCents: 2, feeCents: 2 });
  });

  it("recusa campos inválidos, com mensagem por campo", () => {
    const bad = call("createExam", { date: "2026-02-30", examType: "", billed: "0", caseCode: "Maria Silva" });
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(["date", "examType", "billed", "caseCode"]));
  });

  it("tipos de exame: iniciais sem valor, valor habitual editável e apagar", () => {
    new Api(env).setup();
    let types = call("getData").data.examTypes;
    expect(types.map((t: { name: string; priceCents: number }) => [t.name, t.priceCents])).toEqual([["CBCT", 0], ["Ortopantomografia", 0]]);
    const saved = call("saveExamType", { name: "cbct", price: "80" });
    expect(saved.ok).toBe(true);
    types = saved.data.examTypes;
    expect(types).toHaveLength(2);
    expect(types.find((t: { name: string }) => t.name === "CBCT").priceCents).toBe(8000);
    const orto = types.find((t: { name: string }) => t.name === "Ortopantomografia");
    expect(call("deleteExamType", orto.id).data.examTypes).toHaveLength(1);
    expect(new Api(env).setup()).toEqual([]); // não volta a criar os tipos apagados
    expect(call("getData").data.examTypes).toHaveLength(1);
  });

  it("instalação anterior (sem separadores de exames): são criados ao abrir, com os tipos iniciais", () => {
    new Api(env).setup();
    spreadsheet.sheets.delete("Exames");
    spreadsheet.sheets.delete("TiposExame");
    const data = call("getData").data;
    expect(data.exams).toEqual([]);
    expect(data.examTypes).toHaveLength(2);
    expect(spreadsheet.getSheetByName("Exames")!.rows[0]).toEqual(["id", "data", "exame", "case_id", "valor_cent", "observacao", "criado_em"]);
  });

  it("apagar todos os registos e a demonstração limpam os exames; as definições mantêm-se", () => {
    call("createExam", { date: "2026-09-02", examType: "CBCT", billed: "80" });
    expect(call("clearRecords").data.exams).toEqual([]);
    call("createExam", { date: "2026-09-02", examType: "CBCT", billed: "80" });
    const demo = call("loadDemo").data;
    expect(demo.exams).toEqual([]);
    expect(demo.examTypes.length).toBeGreaterThan(0);
  });

  it("exportação CSV dos exames", () => {
    const r = call("createExam", { date: "2026-09-02", examType: "CBCT", billed: "80,5", caseCode: "DC-2026-007" });
    const csv = exportCsv(buildState(r.data), "exames");
    expect(csv).toMatch(/^﻿id;data;exame;case_id;valor;observacao\r\n/);
    expect(csv).toMatch(/;02\/09\/2026;CBCT;DC-2026-007;80,50;\r\n$/);
  });
});

describe("fecho do mês (folha de honorários)", () => {
  const procedure = { date: "2026-09-02", procedureType: "Restauração", category: "Dentisteria", billed: "70", plannedVisits: "1", start: "09:30", end: "10:15" };

  it("estimativa = atos + exames; com fecho mostra o recebido e a diferença", () => {
    call("saveDay", { date: "2026-09-02", start: "09:30", end: "19:00", breakMinutes: "120" });
    call("createProcedure", procedure);
    call("createExam", { date: "2026-09-02", examType: "CBCT", billed: "60" });
    let state = buildState(call("getData").data);
    const [sep] = monthlySeries(state.records, state.profile, "2026-09", 1);
    const estimate = sep!.feeCents + examTotals(state.exams, "2026-09-01", "2026-09-30", state.profile.feeBps).feeCents;
    expect(estimate).toBe(3_500 + 3_000);
    expect(monthFees("2026-09", estimate, state.closings)).toMatchObject({ status: "estimado", receivedCents: null, differenceCents: null });

    const r = call("saveClosing", { month: "2026-09", received: "80" });
    expect(r.ok).toBe(true);
    state = buildState(r.data);
    expect(monthFees("2026-09", estimate, state.closings)).toMatchObject({ status: "fechado", receivedCents: 8_000, differenceCents: 1_500 });
    // a produção e o €/h do mês continuam a vir dos registos
    expect(applyClosings([sep!], state.closings)[0]).toMatchObject({ fromClosing: false, productionCents: 7_000 });
  });

  it("gravar o mesmo mês substitui o fecho; apagar remove-o", () => {
    call("saveClosing", { month: "2026-08", received: "4000", production: "7500", hours: "130,5", note: "folha de agosto" });
    const r = call("saveClosing", { month: "2026-08", received: "4200,50" });
    expect(r.data.closings).toHaveLength(1);
    expect(r.data.closings[0]).toMatchObject({ month: "2026-08", receivedCents: 420_050, productionCents: null, clinicalMinutes: null, note: null });
    expect(call("deleteClosing", r.data.closings[0].id).data.closings).toEqual([]);
  });

  it("recusa mês futuro, mês inválido, total 0 e horas inválidas, com mensagem por campo", () => {
    expect(call("saveClosing", { month: "2026-10", received: "100" }).errors.month).toMatch(/mês futuro/);
    const bad = call("saveClosing", { month: "2026-13", received: "0", hours: "abc" });
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(["month", "received", "hours"]));
    expect(call("saveClosing", { month: "2026-07", received: "100", hours: "130:30" }).data.closings[0].clinicalMinutes).toBe(7_830);
  });

  it("histórico: mês sem registos usa os totais do fecho (produção, horas, €/h, honorários) e entra na variação", () => {
    call("saveClosing", { month: "2026-08", received: "4000", production: "7500", hours: "125" });
    call("saveDay", { date: "2026-09-02", start: "09:30", end: "19:00", breakMinutes: "120" });
    call("createProcedure", procedure);
    const state = buildState(call("getData").data);
    const [aug, sep] = applyClosings(monthlySeries(state.records, state.profile, "2026-09", 2), state.closings);
    expect(aug).toMatchObject({ fromClosing: true, productionCents: 750_000, feeCents: 400_000, clinicalMinutes: 7_500, centsPerHour: 6_000 });
    expect(sep).toMatchObject({ fromClosing: false, productionCents: 7_000 });
    // só o recebido, sem produção nem horas
    call("saveClosing", { month: "2026-07", received: "3000" });
    const [jul] = applyClosings(monthlySeries(buildState(call("getData").data).records, state.profile, "2026-07", 1), buildState(call("getData").data).closings);
    expect(jul).toMatchObject({ fromClosing: true, productionCents: 0, feeCents: 300_000, centsPerHour: null });
  });

  it("instalação anterior sem FechoMes: separador criado ao abrir; apagar registos mantém os fechos", () => {
    new Api(env).setup();
    spreadsheet.sheets.delete("FechoMes");
    expect(call("getData").data.closings).toEqual([]);
    expect(spreadsheet.getSheetByName("FechoMes")!.rows[0]).toEqual(["id", "mes", "recebido_cent", "producao_cent", "horas_min", "nota", "atualizado_em"]);
    call("saveClosing", { month: "2026-08", received: "4000" });
    expect(call("clearRecords").data.closings).toHaveLength(1);
    expect(call("loadDemo").data.closings).toHaveLength(1);
  });

  it("exportação CSV do fecho", () => {
    const r = call("saveClosing", { month: "2026-08", received: "4000,5", production: "7500", hours: "130,5" });
    expect(exportCsv(buildState(r.data), "fecho")).toBe("﻿mes;recebido;pago_pelos_pacientes;horas;nota\r\n2026-08;4000,50;7500,00;130,50;\r\n");
  });
});
