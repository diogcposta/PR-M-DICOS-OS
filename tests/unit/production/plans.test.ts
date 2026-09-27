import { describe, expect, it } from "vitest";

import type { PlanRecord } from "@/modules/production/domain/monthly";
import { followUpList, openPlanCents, treatmentFunnel } from "@/modules/production/domain/plans";

const plan = (overrides: Partial<PlanRecord>): PlanRecord => ({
  id: overrides.caseCode ?? "p",
  caseCode: "DC-2026-001",
  presentedDate: "2026-09-01",
  diagnosedCents: 0,
  totalCents: 60_000,
  phases: 1,
  status: "PRESENTED",
  acceptedCents: 0,
  performedCents: 0,
  lastContactDate: null,
  nextAppointmentBooked: false,
  ...overrides,
});

describe("follow-up", () => {
  const today = "2026-09-26";

  it("plano > €500 sem próxima consulta → follow-up", () => {
    const [item] = followUpList([plan({ presentedDate: "2026-09-24" })], today);
    expect(item!.priority).toBe("NORMAL");
    expect(item!.alertLevel).toBe(0);
    expect(item!.reasons[0]).toMatch(/sem próxima consulta/);
  });

  it("plano > €1.500 → prioritário", () => {
    const [item] = followUpList([plan({ totalCents: 200_000, presentedDate: "2026-09-25" })], today);
    expect(item!.priority).toBe("PRIORITY");
  });

  it("sem resposta há 7 dias → alerta; 30 dias → segundo alerta", () => {
    const items = followUpList(
      [
        plan({ caseCode: "DC-2026-010", totalCents: 30_000, presentedDate: "2026-09-19" }),
        plan({ caseCode: "DC-2026-011", totalCents: 30_000, presentedDate: "2026-08-27" }),
        plan({ caseCode: "DC-2026-012", totalCents: 30_000, presentedDate: "2026-09-20" }),
      ],
      today,
    );
    expect(items.map((i) => [i.caseCode, i.alertLevel])).toEqual([
      ["DC-2026-011", 2],
      ["DC-2026-010", 1],
    ]);
  });

  it("o último contacto reinicia a contagem de dias", () => {
    const items = followUpList([plan({ totalCents: 30_000, presentedDate: "2026-08-01", lastContactDate: "2026-09-24" })], today);
    expect(items).toEqual([]);
  });

  it("consulta marcada, plano rejeitado ou concluído → sem follow-up", () => {
    const items = followUpList(
      [
        plan({ nextAppointmentBooked: true, totalCents: 500_000, presentedDate: "2026-01-01" }),
        plan({ status: "REJECTED", totalCents: 500_000 }),
        plan({ status: "COMPLETED", totalCents: 500_000, acceptedCents: 500_000, performedCents: 500_000 }),
      ],
      today,
    );
    expect(items).toEqual([]);
  });

  it("aceite com tratamento por realizar e sem consulta → follow-up pelo valor em falta", () => {
    const [item] = followUpList(
      [plan({ status: "ACCEPTED", totalCents: 100_000, acceptedCents: 100_000, performedCents: 30_000 })],
      today,
    );
    expect(item!.openCents).toBe(70_000);
    expect(item!.alertLevel).toBe(0); // já respondeu: não há alerta de "sem resposta"
  });

  it("limiares configuráveis", () => {
    const items = followUpList([plan({ totalCents: 30_000, presentedDate: "2026-09-25" })], today, {
      minCents: 20_000,
      priorityCents: 25_000,
      firstAlertDays: 7,
      secondAlertDays: 30,
    });
    expect(items[0]!.priority).toBe("PRIORITY");
  });

  it("valor em aberto soma planos por decidir e aceites por realizar", () => {
    expect(
      openPlanCents([
        plan({ totalCents: 50_000 }),
        plan({ status: "ACCEPTED", totalCents: 80_000, acceptedCents: 80_000, performedCents: 20_000 }),
        plan({ status: "REJECTED", totalCents: 99_000 }),
      ]),
    ).toBe(110_000);
  });
});

describe("funil de tratamento", () => {
  it("valores e maior perda", () => {
    const funnel = treatmentFunnel([
      plan({ diagnosedCents: 1_000_000, totalCents: 800_000, status: "COMPLETED", acceptedCents: 700_000, performedCents: 700_000 }),
      plan({ diagnosedCents: 1_000_000, totalCents: 900_000, status: "ACCEPTED", acceptedCents: 500_000, performedCents: 0 }),
    ]);
    expect(funnel.stages.map((s) => s.cents)).toEqual([2_000_000, 1_700_000, 1_200_000, 700_000, 700_000]);
    expect(funnel.stages.map((s) => s.count)).toEqual([2, 2, 2, 1, 1]);
    expect(funnel.biggestLossStage).toBe("accepted");
    expect(funnel.stages[1]!.conversionFromPrevious).toBeCloseTo(0.85, 10);
  });

  it("sem planos: conversões sem dados e nenhuma perda", () => {
    const funnel = treatmentFunnel([]);
    expect(funnel.stages.every((s) => s.cents === 0)).toBe(true);
    expect(funnel.stages[1]!.conversionFromPrevious).toBeNull();
    expect(funnel.biggestLossStage).toBeNull();
  });
});
