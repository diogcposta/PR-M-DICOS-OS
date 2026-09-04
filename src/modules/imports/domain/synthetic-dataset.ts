/**
 * Gerador determinístico do conjunto de dados de demonstração.
 *
 * Determinístico a sério: a mesma semente produz exatamente as mesmas linhas,
 * pela mesma ordem. Isso importa porque o importador identifica ficheiros por
 * SHA-256 — se o gerador variasse, cada execução produziria um ficheiro
 * "novo" e a demonstração do bloqueio de duplicados deixaria de funcionar.
 *
 * Nada aqui imita o Newsoft. Os cabeçalhos são os do perfil `SYNTHETIC_AGENDA_V1`
 * e os identificadores são sequenciais e neutros (`CLINIC-001`, `DOCTOR-001`,
 * `PATIENT-001`), sem nomes, contactos ou qualquer dado pessoal.
 *
 * Função pura: devolve linhas em memória. Escrever ficheiros é trabalho do
 * script em `scripts/`, não do domínio.
 */

/** Data de referência do conjunto: tudo é gerado relativamente a ela. */
export const SYNTHETIC_REFERENCE_DATE = "2025-09-15";
export const SYNTHETIC_SEED = 20250915;

export const SYNTHETIC_CLINICS = ["CLINIC-001", "CLINIC-002"] as const;
export const SYNTHETIC_DOCTORS = [
  "DOCTOR-001",
  "DOCTOR-002",
  "DOCTOR-003",
  "DOCTOR-004",
] as const;

/** Cabeçalhos do perfil sintético. Ver `appointment-profile.ts`. */
export const SYNTHETIC_HEADERS = [
  "id_consulta",
  "data_hora",
  "id_clinica",
  "id_medico",
  "ref_paciente",
  "estado",
  "duracao_min",
] as const;

export type SyntheticRow = Record<(typeof SYNTHETIC_HEADERS)[number], string>;

/**
 * Gerador congruencial linear (o dos "Numerical Recipes").
 *
 * Não é criptográfico e não precisa de ser: só queremos variedade reproduzível.
 * `Math.random()` não serve porque não é semeável.
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Inteiro em [0, max). */
  next(max: number): number {
    this.state = (this.state * 1_664_525 + 1_013_904_223) >>> 0;
    return this.state % max;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.next(values.length)] as T;
  }
}

const STATUS_LABELS = {
  COMPLETED: "Realizada",
  NO_SHOW: "Faltou",
  CANCELLED: "Cancelada",
  SCHEDULED: "Agendada",
  RESCHEDULED: "Remarcada",
} as const;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `dd/MM/yyyy HH:mm` — o formato português que o normalizador aceita. */
function formatRow(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  return `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`;
}

export interface SyntheticDatasetOptions {
  /** Meses de histórico a gerar, terminando no mês da data de referência. */
  readonly months?: number;
  readonly seed?: number;
  /** Data de referência `yyyy-MM-dd`: o que vier depois dela é "futuro". */
  readonly referenceDate?: string;
  /** Acrescenta linhas inválidas e IDs duplicados no fim do ficheiro. */
  readonly includeProblemRows?: boolean;
}

export interface SyntheticDataset {
  readonly rows: readonly SyntheticRow[];
  /** Meses `yyyy-MM` deliberadamente deixados sem consultas. */
  readonly emptyMonths: readonly string[];
  readonly validRowCount: number;
  readonly invalidRowCount: number;
  readonly duplicateRowCount: number;
}

/**
 * Constrói o conjunto de demonstração.
 *
 * Cobre de propósito os casos que costumam partir um importador:
 * - fronteiras de mês (00:00 do dia 1 e 23:30 do último dia);
 * - mudanças de hora legal em março e outubro;
 * - um mês inteiro sem consultas, para o dashboard ter de mostrar um vazio real;
 * - consultas futuras, que não devem entrar no denominador das taxas;
 * - linhas inválidas e IDs duplicados, para o relatório de erros ter conteúdo.
 */
export function buildSyntheticDataset(
  options: SyntheticDatasetOptions = {},
): SyntheticDataset {
  const {
    months = 8,
    seed = SYNTHETIC_SEED,
    referenceDate = SYNTHETIC_REFERENCE_DATE,
    includeProblemRows = true,
  } = options;

  const random = new SeededRandom(seed);
  const rows: SyntheticRow[] = [];
  const emptyMonths: string[] = [];

  const [refYear, refMonth, refDay] = referenceDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];

  let sequence = 0;
  let patientCounter = 0;

  const addRow = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    status: keyof typeof STATUS_LABELS,
  ): void => {
    sequence += 1;
    patientCounter = (patientCounter % 120) + 1;
    rows.push({
      id_consulta: `SYN-${pad(sequence, 5)}`,
      data_hora: formatRow(year, month, day, hour, minute),
      id_clinica: random.pick(SYNTHETIC_CLINICS),
      id_medico: random.pick(SYNTHETIC_DOCTORS),
      ref_paciente: `PATIENT-${pad(patientCounter, 3)}`,
      estado: STATUS_LABELS[status],
      duracao_min: String(random.pick([15, 30, 30, 45, 60])),
    });
  };

  // Percorre os meses do mais antigo para o mais recente.
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const absolute = refYear * 12 + (refMonth - 1) - offset;
    const year = Math.floor(absolute / 12);
    const month = (absolute % 12) + 1;
    const monthKey = `${year}-${pad(month)}`;
    const isFutureMonth = year * 12 + month > refYear * 12 + refMonth;
    const lastDay = lastDayOfMonth(year, month);

    // Um mês sem qualquer consulta: o dashboard tem de o mostrar como vazio,
    // e não como zero.
    if (offset === 2) {
      emptyMonths.push(monthKey);
      continue;
    }

    // Fronteiras do mês, sempre presentes: primeiro instante e último.
    addRow(year, month, 1, 0, 0, isFutureMonth ? "SCHEDULED" : "COMPLETED");
    addRow(year, month, lastDay, 23, 30, isFutureMonth ? "SCHEDULED" : "COMPLETED");

    const appointmentsThisMonth = 18 + random.next(12);
    for (let i = 0; i < appointmentsThisMonth; i += 1) {
      const day = 1 + random.next(lastDay);
      const hour = 8 + random.next(11);
      const minute = random.pick([0, 15, 30, 45]);

      const isFutureDay =
        year > refYear ||
        (year === refYear && month > refMonth) ||
        (year === refYear && month === refMonth && day > refDay);

      // Consultas por acontecer ficam SCHEDULED; as passadas têm desfecho.
      const status = isFutureDay
        ? random.pick(["SCHEDULED", "SCHEDULED", "SCHEDULED", "RESCHEDULED"] as const)
        : random.pick([
            "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
            "COMPLETED", "COMPLETED", "NO_SHOW", "CANCELLED", "CANCELLED",
          ] as const);

      addRow(year, month, day, hour, minute, status);
    }
  }

  const validRowCount = rows.length;
  let invalidRowCount = 0;
  let duplicateRowCount = 0;

  if (includeProblemRows) {
    // --- IDs duplicados: repetem duas linhas já existentes, tal e qual.
    const first = rows[0];
    const middle = rows[Math.floor(rows.length / 2)];
    if (first && middle) {
      rows.push({ ...first }, { ...middle });
      duplicateRowCount = 2;
    }

    // --- Linhas inválidas, uma por tipo de erro que o validador reconhece.
    const invalid: SyntheticRow[] = [
      {
        // Data inexistente no calendário.
        id_consulta: "SYN-ERR-01", data_hora: "31/02/2025 09:00", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-901", estado: "Realizada", duracao_min: "30",
      },
      {
        // Data em falta.
        id_consulta: "SYN-ERR-02", data_hora: "", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-902", estado: "Realizada", duracao_min: "30",
      },
      {
        // Formato de data não reconhecido.
        id_consulta: "SYN-ERR-03", data_hora: "2025-13-45", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-903", estado: "Realizada", duracao_min: "30",
      },
      {
        // Clínica em falta.
        id_consulta: "SYN-ERR-04", data_hora: "10/06/2025 09:00", id_clinica: "",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-904", estado: "Realizada", duracao_min: "30",
      },
      {
        // Clínica que não existe na organização.
        id_consulta: "SYN-ERR-05", data_hora: "10/06/2025 10:00", id_clinica: "CLINIC-404",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-905", estado: "Realizada", duracao_min: "30",
      },
      {
        // Médico que não existe na organização.
        id_consulta: "SYN-ERR-06", data_hora: "10/06/2025 11:00", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-404", ref_paciente: "PATIENT-906", estado: "Realizada", duracao_min: "30",
      },
      {
        // Estado sem mapeamento: erro, nunca convertido em UNKNOWN.
        id_consulta: "SYN-ERR-07", data_hora: "10/06/2025 12:00", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-907", estado: "Em análise", duracao_min: "30",
      },
      {
        // Estado em falta.
        id_consulta: "SYN-ERR-08", data_hora: "10/06/2025 13:00", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-908", estado: "", duracao_min: "30",
      },
      {
        // Duração não numérica.
        id_consulta: "SYN-ERR-09", data_hora: "10/06/2025 14:00", id_clinica: "CLINIC-001",
        id_medico: "DOCTOR-001", ref_paciente: "PATIENT-909", estado: "Realizada", duracao_min: "meia hora",
      },
    ];
    rows.push(...invalid);
    invalidRowCount = invalid.length;
  }

  return { rows, emptyMonths, validRowCount, invalidRowCount, duplicateRowCount };
}

/** Serializa em CSV com `;`, o separador habitual das exportações portuguesas. */
export function toCsv(dataset: SyntheticDataset): string {
  const lines = [SYNTHETIC_HEADERS.join(";")];
  for (const row of dataset.rows) {
    lines.push(SYNTHETIC_HEADERS.map((header) => row[header]).join(";"));
  }
  return `${lines.join("\n")}\n`;
}
