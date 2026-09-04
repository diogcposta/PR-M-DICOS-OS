# Prompt 5 — financeiro, orçamentos e pacientes

Executa esta fase apenas depois de os contratos e definições de negócio terem sido aprovados com amostras anonimizadas.

Implementa perfis separados para produção/faturação, orçamentos, dívida e estados de paciente. Mantém cada conceito separado no modelo canónico. Adiciona os KPIs aprovados, explicabilidade da fórmula e testes de reversões, snapshots, duplicados e períodos.

Não inferir que produção, faturação, cobrança ou saldo são equivalentes. Não ativar KPIs de “ativo”, “perdido” ou “reativado” enquanto a definição não estiver escrita e versionada em `docs/KPI_CATALOG.md`.

