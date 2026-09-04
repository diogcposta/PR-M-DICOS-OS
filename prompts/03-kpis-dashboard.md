# Prompt 3 — KPIs e dashboard

Lê `CLAUDE.md`, `docs/KPI_CATALOG.md` e a implementação atual. Confirma as fases anteriores.

Implementa apenas a Fase 3:

- catálogo de KPI tipado e versionado;
- consultas determinísticas para consultas agendadas, realizadas, faltas, cancelamentos e respetivas taxas;
- filtros por período, clínica e médico;
- comparação com o período imediatamente anterior de duração equivalente;
- série temporal mensal;
- dashboard responsivo com cartões, gráfico, tabela resumida e estados sem dados;
- detalhe “Como é calculado?” com fórmula, numerador, denominador, fontes e versão;
- testes de fronteiras de datas, timezone Europe/Lisbon, denominador zero, filtros e comparação;
- não implementar ainda KPIs financeiros ou de pacientes sem fixtures/contratos validados.

Não uses IA para calcular, ordenar ou explicar números. Executa lint, tipos, testes e um teste E2E do filtro principal.

