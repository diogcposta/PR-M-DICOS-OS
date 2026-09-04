# Prompt 1 — bootstrap técnico

Lê integralmente `CLAUDE.md` e `docs/*.md`. Estamos a iniciar o PR Médicos OS do zero.

Executa apenas a Fase 1: criar uma base técnica funcional e demonstrável.

Requisitos:

1. Inicializa uma aplicação Next.js com App Router, TypeScript estrito, Tailwind e linting, usando versões estáveis e compatíveis.
2. Configura PostgreSQL local com Docker Compose e Prisma.
3. Implementa o modelo inicial: `Organization`, `Clinic`, `Practitioner`, `ImportProfile`, `ImportBatch`, `ImportRowError`, `AppointmentFact`, `FinancialFact`, `BudgetFact` e `PatientStatusSnapshot`. Usa dinheiro em cêntimos, timestamps adequados, índices, enums explícitos e relações por `organizationId`.
4. Cria seed apenas com dados sintéticos de uma organização, duas clínicas e dois médicos.
5. Cria o layout da aplicação, navegação para Dashboard, Importações e Catálogo de KPIs, e estados vazios honestos. Não simules KPIs como se fossem reais.
6. Cria `AIAnalysisProvider`, tipos de entrada/saída e `DisabledAIProvider`; não instales SDK de IA e não cries chamadas externas.
7. Cria validação tipada de variáveis de ambiente e `.env.example` sem segredos.
8. Adiciona testes unitários mínimos para invariantes do domínio e um teste de saúde da aplicação.
9. Atualiza `README.md` com comandos exatos para instalar, iniciar a base, migrar, fazer seed, arrancar e testar.
10. Executa instalação, geração Prisma, migração, lint, verificação de tipos e testes. Corrige os problemas encontrados.

Restrições:

- não integrar Newsoft;
- não implementar ainda parsing de Excel/CSV;
- não implementar autenticação fictícia;
- não usar dados pessoais reais;
- não colocar regras de negócio em componentes React ou route handlers;
- não criar microserviços.

Antes de editar, mostra um plano curto e confirma o estado atual do repositório. No fim, apresenta ficheiros principais, comandos verificados, testes executados e decisões ainda pendentes. Não avances para a Fase 2.

