/**
 * Consultas de agregação sobre `AppointmentFact`.
 *
 * Esta é a única camada que sabe SQL. As fronteiras do período chegam já
 * calculadas como instantes UTC pelo domínio (`period.ts`); aqui não se faz
 * aritmética de fusos — exceto no agrupamento mensal, onde o Postgres precisa de
 * saber o fuso de negócio para saber a que mês pertence cada instante.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import {
  type AppointmentStatusCounts,
  EMPTY_STATUS_COUNTS,
} from "@/modules/kpis/domain/appointment-kpis";
import type { Period } from "@/modules/kpis/domain/period";

export interface AppointmentFilters {
  readonly organizationId: string;
  readonly clinicId?: string | undefined;
  readonly practitionerId?: string | undefined;
}

function whereClause(filters: AppointmentFilters, period: Period) {
  return {
    organizationId: filters.organizationId,
    ...(filters.clinicId ? { clinicId: filters.clinicId } : {}),
    ...(filters.practitionerId ? { practitionerId: filters.practitionerId } : {}),
    // Intervalo semi-aberto [início, fim): uma consulta à meia-noite do dia
    // seguinte pertence ao período seguinte, nunca aos dois.
    occurredAt: { gte: period.startsAt, lt: period.endsAt },
  };
}

/** Contagens por estado para um período e conjunto de filtros. */
export async function countByStatus(
  filters: AppointmentFilters,
  period: Period,
): Promise<AppointmentStatusCounts> {
  const grouped = await prisma.appointmentFact.groupBy({
    by: ["status"],
    where: whereClause(filters, period),
    _count: { _all: true },
  });

  const counts: Record<string, number> = { ...EMPTY_STATUS_COUNTS };
  for (const group of grouped) {
    counts[group.status] = group._count._all;
  }

  return counts as unknown as AppointmentStatusCounts;
}

export interface MonthlyPoint {
  /** Primeiro dia do mês civil, em `yyyy-MM`. */
  readonly month: string;
  readonly counts: AppointmentStatusCounts;
}

interface MonthlyRow {
  month: string;
  status: string;
  total: bigint;
}

/**
 * Série mensal por mês civil de `Europe/Lisbon`.
 *
 * `occurredAt` é `timestamp without time zone` e guarda o instante em UTC. A
 * conversão tem de ser em dois passos: primeiro dizer ao Postgres que o valor
 * está em UTC, depois convertê-lo para o fuso de negócio. Um único
 * `AT TIME ZONE 'Europe/Lisbon'` faria o oposto — interpretaria o valor como já
 * sendo hora de Lisboa — e uma consulta de 1 de agosto às 00:30 apareceria em
 * julho, com o gráfico a mostrar uma quebra na fronteira de cada mês.
 */
export async function monthlyCountsByStatus(
  filters: AppointmentFilters,
  period: Period,
): Promise<readonly MonthlyPoint[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"organizationId" = ${filters.organizationId}`,
    Prisma.sql`"occurredAt" >= ${period.startsAt}`,
    Prisma.sql`"occurredAt" < ${period.endsAt}`,
  ];

  if (filters.clinicId) {
    conditions.push(Prisma.sql`"clinicId" = ${filters.clinicId}`);
  }
  if (filters.practitionerId) {
    conditions.push(Prisma.sql`"practitionerId" = ${filters.practitionerId}`);
  }

  const rows = await prisma.$queryRaw<MonthlyRow[]>(Prisma.sql`
    SELECT
      to_char(
        date_trunc(
          'month',
          ("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${period.timeZone}
        ),
        'YYYY-MM'
      ) AS month,
      "status"::text AS status,
      count(*) AS total
    FROM "appointment_facts"
    WHERE ${Prisma.join(conditions, " AND ")}
    GROUP BY 1, 2
    ORDER BY 1
  `);

  const byMonth = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const bucket = byMonth.get(row.month) ?? { ...EMPTY_STATUS_COUNTS };
    bucket[row.status] = Number(row.total);
    byMonth.set(row.month, bucket);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({
      month,
      counts: counts as unknown as AppointmentStatusCounts,
    }));
}

export interface FilterOption {
  readonly id: string;
  readonly label: string;
}

/** Clínicas e médicos disponíveis para filtrar. */
export async function listFilterOptions(organizationId: string): Promise<{
  readonly clinics: readonly FilterOption[];
  readonly practitioners: readonly FilterOption[];
}> {
  const [clinics, practitioners] = await Promise.all([
    prisma.clinic.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.practitioner.findMany({
      where: { organizationId },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  return {
    clinics: clinics.map((clinic) => ({ id: clinic.id, label: clinic.name })),
    practitioners: practitioners.map((p) => ({ id: p.id, label: p.displayName })),
  };
}

/** Lotes que contribuíram para o período, para o KPI poder citar a origem. */
export async function sourceBatchIds(
  filters: AppointmentFilters,
  period: Period,
): Promise<readonly string[]> {
  const grouped = await prisma.appointmentFact.groupBy({
    by: ["importBatchId"],
    where: whereClause(filters, period),
  });
  return grouped.map((group) => group.importBatchId);
}
