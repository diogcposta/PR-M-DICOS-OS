# PR Médicos OS

Gestão analítica para clínicas. Recebe exportações manuais em Excel/CSV, preserva o histórico, calcula KPIs com definições explícitas e destaca as áreas onde a gestão deve intervir. Não substitui o Newsoft nem copia o seu dashboard.

Antes de mexer no código, ler `CLAUDE.md`, `docs/MVP.md` e `docs/ARCHITECTURE.md`.

## Estado atual — Fase 1 concluída

A base técnica está de pé e é demonstrável:

- aplicação Next.js (App Router) com TypeScript estrito e Tailwind;
- PostgreSQL com Prisma, esquema canónico migrado e seed sintético;
- navegação Dashboard / Importações / Catálogo de KPIs, com estados vazios honestos;
- contrato `AIAnalysisProvider` e `DisabledAIProvider` — nenhum SDK de IA instalado;
- validação tipada de variáveis de ambiente;
- testes unitários de domínio e teste de saúde da aplicação.

**Ainda não existe** importação de ficheiros nem cálculo de KPIs. Nenhum número apresentado no dashboard é simulado: onde não há dados, o ecrã diz que não há.

## Requisitos

- Node.js 20 ou superior (testado com 26.7);
- PostgreSQL 18 — via Docker ou via Homebrew (ver abaixo).

## Instalação

```bash
npm install
```

## Base de dados

### Opção A — Docker (recomendada quando disponível)

```bash
npm run db:up
```

### Opção B — Homebrew (macOS sem Docker)

```bash
brew install postgresql@18
brew services start postgresql@18
```

Criar o utilizador e a base de dados (uma única vez):

```bash
/usr/local/opt/postgresql@18/bin/psql -d postgres -c "CREATE ROLE pr_medicos WITH LOGIN PASSWORD 'pr_medicos_dev' CREATEDB;"
/usr/local/opt/postgresql@18/bin/createdb -O pr_medicos pr_medicos_os
```

## Configuração

```bash
cp .env.example .env
```

O `.env` de desenvolvimento aponta para a base local e usa apenas dados sintéticos. Nunca colocar segredos reais no `.env.example`.

## Migrar e semear

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

O seed cria uma organização, duas clínicas e dois médicos fictícios. Não cria factos: o dashboard tem de mostrar estados vazios verdadeiros.

## Arrancar

```bash
npm run dev
```

- <http://localhost:3000/> — Dashboard
- <http://localhost:3000/imports> — Histórico de importações
- <http://localhost:3000/kpis> — Catálogo de KPIs
- <http://localhost:3000/api/health> — Saúde da aplicação

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
```

Os testes da Fase 1 não precisam de base de dados a correr: são todos deterministas e sem I/O. Testes de integração entram na Fase 2, com o pipeline de importação.

## Inspecionar a base de dados

```bash
npm run db:studio
```

## Estrutura

```text
prisma/            esquema, migrações e seed sintético
src/app/           páginas, layout e route handlers (sem regras de negócio)
src/components/    UI acessível e reutilizável
src/modules/
  imports/         contrato canónico de importação (Fase 2)
  kpis/            dinheiro, períodos, rácios e catálogo de KPIs
  ai/              contrato neutro de fornecedor + implementação desativada
  organizations/   contexto de organização
src/lib/
  db/              cliente Prisma
  env/             validação de ambiente
  observability/   logging com allowlist de campos
tests/unit/        testes de domínio e de saúde
docs/              MVP, arquitetura, contrato de importação, KPIs e decisões
prompts/           os pedidos de cada fase
```

## Princípios já decididos

- Sem integração com a API do Newsoft no MVP.
- Importação manual de Excel/CSV, com pré-visualização, validação e relatório de erros.
- PostgreSQL como fonte histórica de verdade.
- KPIs determinísticos, testados e independentes de IA.
- A IA é opcional e acede apenas a dados agregados e minimizados.
- Arquitetura preparada para substituir OpenAI por outro fornecedor.
- Valores monetários em cêntimos; instantes em UTC com contexto de negócio `Europe/Lisbon`.
- Não usar dados reais de pacientes durante o desenvolvimento.

## Fase seguinte

`prompts/02-import-pipeline.md` — pipeline de importação com pré-visualização, mapeamento de colunas e confirmação transacional.
