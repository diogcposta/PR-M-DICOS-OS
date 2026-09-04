import { describe, expect, it } from "vitest";

import {
  formatPeriodLabel,
  parseDashboardFilters,
  todayInBusinessTimeZone,
} from "@/modules/kpis/application/parse-dashboard-filters";

describe("data de hoje no fuso de negócio", () => {
  it("usa o dia civil de Lisboa e não o do servidor", () => {
    // 23:30 UTC de 30 de junho já é 1 de julho em Lisboa (hora de verão).
    const instant = new Date("2025-06-30T23:30:00.000Z");
    expect(todayInBusinessTimeZone(instant)).toBe("2025-07-01");
  });

  it("no inverno Lisboa coincide com UTC", () => {
    expect(todayInBusinessTimeZone(new Date("2025-01-15T23:30:00.000Z"))).toBe("2025-01-15");
  });
});

describe("filtros do dashboard", () => {
  const NOW = new Date("2025-04-17T10:00:00.000Z");

  it("por omissão mostra o mês corrente até hoje", () => {
    const filters = parseDashboardFilters({}, NOW);
    expect(filters.fromDate).toBe("2025-04-01");
    expect(filters.toDate).toBe("2025-04-17");
  });

  it("respeita as datas indicadas", () => {
    const filters = parseDashboardFilters({ de: "2025-01-01", ate: "2025-03-31" }, NOW);
    expect(filters.fromDate).toBe("2025-01-01");
    expect(filters.toDate).toBe("2025-03-31");
  });

  it("ignora datas mal formadas em vez de rebentar", () => {
    const filters = parseDashboardFilters({ de: "01/01/2025", ate: "" }, NOW);
    expect(filters.fromDate).toBe("2025-04-01");
    expect(filters.toDate).toBe("2025-04-17");
  });

  it("corrige datas trocadas em vez de mostrar um erro", () => {
    const filters = parseDashboardFilters({ de: "2025-03-31", ate: "2025-01-01" }, NOW);
    expect(filters.fromDate).toBe("2025-01-01");
    expect(filters.toDate).toBe("2025-03-31");
  });

  it("lê clínica e médico, tratando vazio como ausente", () => {
    const filters = parseDashboardFilters({ clinica: "c1", medico: "" }, NOW);
    expect(filters.clinicId).toBe("c1");
    expect(filters.practitionerId).toBeUndefined();
  });

  it("aceita também URLSearchParams", () => {
    const filters = parseDashboardFilters(
      new URLSearchParams("de=2025-02-01&ate=2025-02-28&clinica=c9"),
      NOW,
    );
    expect(filters.fromDate).toBe("2025-02-01");
    expect(filters.clinicId).toBe("c9");
  });
});

describe("rótulo do período", () => {
  it("formata à portuguesa", () => {
    expect(formatPeriodLabel("2025-01-01", "2025-01-31")).toBe("01/01/2025 a 31/01/2025");
  });

  it("colapsa um único dia", () => {
    expect(formatPeriodLabel("2025-01-01", "2025-01-01")).toBe("01/01/2025");
  });
});
