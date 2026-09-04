# PR Médicos OS

Gestão analítica para clínicas. Recebe exportações manuais em Excel/CSV, preserva o histórico, calcula KPIs com definições explícitas e destaca as áreas onde a gestão deve intervir. Não substitui o Newsoft nem copia o seu dashboard.

Antes de mexer no código, ler `CLAUDE.md`, `docs/MVP.md` e `docs/ARCHITECTURE.md`.

## Estado atual — Fase 2 concluída

O pipeline de importação de agenda está funcional de ponta a ponta:

- upload de `.csv` e `.xlsx` no servidor, com limites de tipo (20 MB) e rejeição antes do parsing;
- SHA-256 por ficheiro, com aviso na pré-visualização e bloqueio de reimportação;
- deteção de folhas e cabeçalhos, amostra das primeiras 10 linhas;
- mapeamento de colunas editável, sugerido a partir dos cabeçalhos;
- validação de datas portuguesas, estados, IDs e campos obrigatórios, com erro por linha/coluna;
- confirmação transacional com `AppointmentFact` idempotente;
- perfil de mapeamento versionado e histórico de lotes com detalhe.

A base técnica da Fase 1 continua de pé:

- aplicação Next.js (App Router) com TypeScript estrito e Tailwind;
- PostgreSQL com Prisma, esquema canónico migrado e seed sintético;
- navegação Dashboard / Importações / Catálogo de KPIs, com estados vazios honestos;
- contrato `AIAnalysisProvider` e `DisabledAIProvider` — nenhum SDK de IA instalado;
- validação tipada de variáveis de ambiente;
- testes unitários de domínio e teste de saúde da aplicação.

**Ainda não existe** cálculo de KPIs — é a Fase 3. Nenhum número apresentado no dashboard é simulado: onde não há dados, o ecrã diz que não há.

O perfil de mapeamento é **sintético**. Os cabeçalhos (`id_consulta`, `data_hora`, …) foram inventados para as fixtures deste repositório e não representam nenhuma exportação real do Newsoft.

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

## Demonstrar o fluxo de importação

1. `npm run dev` e abrir <http://localhost:3000/imports>;
2. clicar em **Importar ficheiro**;
3. escolher `tests/fixtures/agenda-valida.csv` — aparecem os cabeçalhos, o separador detetado, a amostra e o mapeamento sugerido;
4. **Validar** → 6 linhas, 6 válidas, 0 inválidas;
5. **Confirmar importação** → 6 consultas gravadas, com ligação para o detalhe do lote;
6. repetir com o mesmo ficheiro → aviso de duplicado na pré-visualização e lote registado como `DUPLICATE`, sem gravar nada;
7. repetir com `tests/fixtures/agenda-com-erros.csv` → 7 linhas inválidas com erro por linha e coluna; confirmar fica bloqueado até assinalar explicitamente "gravar apenas as linhas válidas";
8. `tests/fixtures/agenda-valida.xlsx` demonstra o mesmo com Excel e duas folhas.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Os testes estão em três níveis:

- **unit** (`tests/unit`) — domínio e parsers, sem I/O e sem base de dados;
- **integration** (`tests/integration`) — deduplicação, política de linhas e rollback, contra `TEST_DATABASE_URL`;
- **e2e** (`tests/e2e`) — fluxo crítico de importação no browser, com Playwright.

Os testes de integração e e2e usam uma base separada. Criar uma vez:

```bash
/usr/local/opt/postgresql@18/bin/createdb -O pr_medicos pr_medicos_os_test
```

O Playwright arranca o seu próprio servidor: parar o `npm run dev` antes de correr `npm run test:e2e`, porque o Next recusa dois servidores de desenvolvimento na mesma pasta.

As fixtures são totalmente sintéticas — ver `tests/fixtures/README.md`.

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
  imports/         parsing, normalização, validação e commit transacional
  kpis/            dinheiro, períodos, rácios e catálogo de KPIs
  ai/              contrato neutro de fornecedor + implementação desativada
  organizations/   contexto de organização
src/lib/
  db/              cliente Prisma
  env/             validação de ambiente
  observability/   logging com allowlist de campos
tests/unit/        domínio e parsers, sem I/O
tests/integration/ deduplicação, políticas e rollback, com base de dados
tests/e2e/         fluxo crítico de importação (Playwright)
tests/fixtures/    ficheiros sintéticos CSV/XLSX
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

`prompts/03-kpis-dashboard.md` — cálculo determinístico de KPIs, filtros por período/clínica/médico e comparação com o período anterior.
