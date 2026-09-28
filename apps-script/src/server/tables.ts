/**
 * Estrutura do Google Sheets usado como base de dados (um separador por tabela).
 *
 * Regras iguais às da base SQLite: dinheiro em cêntimos inteiros, datas civis
 * `aaaa-mm-dd` e horas `HH:mm` guardadas como TEXTO (para o Sheets não as
 * converter em datas), sem dados identificáveis de pacientes.
 * Os cabeçalhos são em português; não os altere (a leitura é feita pelo nome).
 */

export type ColumnType = "text" | "int" | "float" | "bool" | "date" | "time";

export interface Column {
  readonly field: string;
  readonly header: string;
  readonly type: ColumnType;
  readonly nullable?: boolean;
}

export interface TableDef {
  readonly name: string;
  readonly columns: readonly Column[];
}

const c = (field: string, header: string, type: ColumnType, nullable = false): Column => ({ field, header, type, nullable });

export const TABLES = {
  profile: {
    name: "Perfil",
    columns: [
      c("id", "id", "text"),
      c("name", "nome", "text"),
      c("feeBps", "percentagem_bps", "int"),
      c("feeBase", "base_honorarios", "text"),
      c("standardSlotMinutes", "consulta_standard_min", "int"),
      c("saturdayMinutes", "sabado_min", "int"),
      c("primaryGoalCentsPerHour", "objetivo_principal_cent_h", "int"),
      c("targetNoShowBps", "faltas_referencia_bps", "int"),
      c("followUpMinCents", "followup_minimo_cent", "int"),
      c("followUpPriorityCents", "followup_prioritario_cent", "int"),
      c("followUpFirstAlertDays", "alerta1_dias", "int"),
      c("followUpSecondAlertDays", "alerta2_dias", "int"),
    ],
  },
  schedule: {
    name: "Horario",
    columns: [c("id", "id", "text"), c("weekday", "dia_semana", "int"), c("startMinute", "inicio", "time"), c("endMinute", "fim", "time")],
  },
  goals: {
    name: "Objetivos",
    columns: [c("id", "id", "text"), c("label", "nome", "text"), c("centsPerHour", "cent_por_hora", "int"), c("sortOrder", "ordem", "int")],
  },
  scenarios: {
    name: "Cenarios",
    columns: [
      c("id", "id", "text"),
      c("name", "nome", "text"),
      c("centsPerHour", "cent_por_hora", "int", true),
      c("hoursPerMonth", "horas_mes", "float"),
      c("sortOrder", "ordem", "int"),
    ],
  },
  templates: {
    name: "Templates",
    columns: [
      c("id", "id", "text"),
      c("name", "nome", "text"),
      c("category", "categoria", "text"),
      c("priceCents", "preco_cent", "int"),
      c("durationMinutes", "duracao_min", "int"),
      c("plannedVisits", "consultas", "int"),
      c("labCostCents", "laboratorio_cent", "int"),
      c("payerType", "pagador", "text"),
      c("favorite", "favorito", "bool"),
    ],
  },
  days: {
    name: "Dias",
    columns: [
      c("id", "id", "text"),
      c("date", "data", "date"),
      c("startMinute", "inicio", "time"),
      c("endMinute", "fim", "time"),
      c("breakMinutes", "pausa_min", "int"),
      c("status", "estado", "text"),
      c("note", "nota", "text", true),
    ],
  },
  procedures: {
    name: "Procedimentos",
    columns: [
      c("id", "id", "text"),
      c("date", "data", "date"),
      c("caseCode", "case_id", "text", true),
      c("procedureType", "procedimento", "text"),
      c("category", "categoria", "text"),
      c("listPriceCents", "valor_tabelado_cent", "int"),
      c("billedCents", "valor_faturado_cent", "int"),
      c("payerType", "pagador", "text"),
      c("payerName", "seguradora", "text", true),
      c("plannedVisits", "consultas_previstas", "int"),
      c("labCostCents", "laboratorio_cent", "int"),
      c("otherCostCents", "outros_custos_cent", "int"),
      c("note", "observacao", "text", true),
      c("completed", "concluido", "bool"),
      c("createdAt", "criado_em", "text"),
    ],
  },
  sessions: {
    name: "Consultas",
    columns: [
      c("id", "id", "text"),
      c("procedureId", "procedimento_id", "text"),
      c("date", "data", "date"),
      c("startMinute", "inicio", "time"),
      c("endMinute", "fim", "time"),
    ],
  },
  absences: {
    name: "Faltas",
    columns: [
      c("id", "id", "text"),
      c("date", "data", "date"),
      c("startMinute", "hora", "time"),
      c("durationMinutes", "duracao_min", "int"),
      c("plannedProcedure", "procedimento_previsto", "text", true),
      c("estimatedValueCents", "valor_estimado_cent", "int"),
      c("payerType", "pagador", "text"),
      c("kind", "tipo", "text"),
      c("slotRecovered", "slot_recuperado", "bool"),
      c("recoveredValueCents", "receita_recuperada_cent", "int"),
    ],
  },
  plans: {
    name: "Planos",
    columns: [
      c("id", "id", "text"),
      c("caseCode", "case_id", "text"),
      c("presentedDate", "data_apresentacao", "date"),
      c("diagnosedCents", "valor_diagnosticado_cent", "int"),
      c("totalCents", "valor_total_cent", "int"),
      c("phases", "fases", "int"),
      c("status", "estado", "text"),
      c("acceptedCents", "valor_aceite_cent", "int"),
      c("performedCents", "valor_realizado_cent", "int"),
      c("lastContactDate", "ultimo_contacto", "date", true),
      c("nextAppointmentBooked", "proxima_consulta_marcada", "bool"),
      c("note", "observacao", "text", true),
    ],
  },
  exams: {
    name: "Exames",
    columns: [
      c("id", "id", "text"),
      c("date", "data", "date"),
      c("examType", "exame", "text"),
      c("caseCode", "case_id", "text", true),
      c("billedCents", "valor_cent", "int"),
      c("note", "observacao", "text", true),
      c("createdAt", "criado_em", "text"),
    ],
  },
  examTypes: {
    name: "TiposExame",
    columns: [c("id", "id", "text"), c("name", "nome", "text"), c("priceCents", "preco_cent", "int")],
  },
  closings: {
    name: "FechoMes",
    columns: [
      c("id", "id", "text"),
      c("month", "mes", "text"),
      c("receivedCents", "recebido_cent", "int"),
      c("productionCents", "producao_cent", "int", true),
      c("clinicalMinutes", "horas_min", "int", true),
      c("note", "nota", "text", true),
      c("updatedAt", "atualizado_em", "text"),
    ],
  },
} as const satisfies Record<string, TableDef>;

export type TableKey = keyof typeof TABLES;
export type Row = Record<string, string | number | boolean | null>;
