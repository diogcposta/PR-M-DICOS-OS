# PR Médicos OS — módulo Clínica (importações Newsoft, PostgreSQL)

> Este documento era o README principal. O README atual descreve o Clinical Production Dashboard
> (`/producao`); este módulo continua disponível em `/` quando `DATABASE_URL` está configurado.

Gestão analítica para clínicas. Recebe exportações manuais em Excel/CSV, preserva o histórico, calcula KPIs com definições explícitas e destaca as áreas onde a gestão deve intervir. Não substitui o Newsoft nem copia o seu dashboard.

Antes de mexer no código, ler `CLAUDE.md`, `docs/MVP.md` e `docs/ARCHITECTURE.md`.

## Estado atual — Fase 4A concluída (demonstração com dados sintéticos)

A Fase 4 (adaptação aos ficheiros reais do Newsoft) está **pendente**: precisa de exportações
anonimizadas que ainda não recebemos. Enquanto isso, a Fase 4A reforça o MVP inteiramente com
dados sintéticos, para ficar demonstrável e robusto sem inventar formato Newsoft nenhum:

- perfil de mapeamento chamado explicitamente **`SYNTHETIC_AGENDA_V1`** — nunca "Newsoft" — e
  identificadores neutros (`CLINIC-001`, `DOCTOR-001`, `PATIENT-001`), sem nomes nem contactos;
- gerador **determinístico** de dados sintéticos (`scripts/generate-synthetic-data.ts`): a mesma
  semente produz sempre o mesmo ficheiro, byte a byte — cobre 2 clínicas, 4 médicos, 8 meses,
  consultas realizadas/canceladas/faltas/futuras, um mês sem dados, datas nas fronteiras do mês,
  linhas inválidas e IDs duplicados, em `.csv` e `.xlsx`;
- comando repetível `npm run demo:seed`, que regenera as fixtures e importa-as pelo mesmo
  caminho de código do ecrã (idempotente: a segunda execução é recusada como duplicada);
- resumo da importação em três vias — aceites / rejeitadas / ignoradas — e relatório de erros
  **descarregável em CSV**, pronto para o Excel português;
- **proveniência completa** em cada KPI: versão da definição, período e filtros aplicados,
  numerador e denominador, lotes de origem e data da última atualização;
- página **Qualidade dos dados**, com lotes importados, motivos de rejeição, duplicados, campos
  em falta e a cobertura temporal real (incluindo buracos no meio da série);
- estados de carregamento e de erro no dashboard, e uma marca visual persistente sempre que os
  dados apresentados forem sintéticos;
- testes de **isolamento entre organizações**, com identificadores externos propositadamente
  repetidos entre duas organizações de teste.

As fases anteriores continuam de pé e testadas:

- **Fase 3** — seis KPIs de agenda (consultas agendadas, realizadas, faltas e as três taxas),
  filtros por período/clínica/médico no URL, comparação com o período anterior, série mensal por
  mês civil de `Europe/Lisbon`, "Como é calculado?" em cada cartão, divisão por zero em "sem
  dados" nunca 0%;
- **Fase 2** — upload de `.csv`/`.xlsx` com limites e rejeição antes do parsing, SHA-256 com
  bloqueio de reimportação, mapeamento de colunas editável, validação de datas portuguesas,
  confirmação transacional com `AppointmentFact` idempotente;
- **Fase 1** — Next.js (App Router) com TypeScript estrito, PostgreSQL com Prisma, contrato
  `AIAnalysisProvider`/`DisabledAIProvider` sem nenhum SDK de IA, validação tipada de ambiente.

**Os KPIs financeiros e de pacientes continuam bloqueados**: não há definição de negócio aprovada
para "ativo", "perdido" ou "reativado", nem amostras validadas de produção e faturação. Calculá-los
seria inventar a definição.

As fórmulas de agenda estão fixadas e testadas, mas **ainda não foram validadas com o responsável
de negócio** — o ecrã marca cada uma como "definição provisória" e diz o que falta decidir. O
denominador das taxas está registado em D-019.

O perfil de mapeamento é **sintético** (`SYNTHETIC_AGENDA_V1`). Os cabeçalhos (`id_consulta`,
`data_hora`, …) foram inventados para as fixtures deste repositório e não representam nenhuma
exportação real do Newsoft. Ver "Substituir o perfil sintético por um real", mais abaixo.

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

## Limpar a base de desenvolvimento

Depois de experimentar importações, para voltar ao estado inicial:

```bash
npm run db:reset
```

Isto apaga **todos** os dados da base indicada em `DATABASE_URL`, reaplica as migrações e volta a semear. Nunca correr contra uma base de produção.

O `db:reset` encadeia dois passos de propósito. No Prisma 7 o seed deixou de ser executado automaticamente pelas migrações: o `prisma migrate reset` aplica as migrações e para aí. Sozinho, deixaria a base completamente vazia — sem sequer uma organização, e as páginas mostrariam "Nenhuma organização configurada".

Se for um agente de IA a correr o comando, o Prisma bloqueia-o e exige consentimento explícito do utilizador. É intencional, e o `--force` não substitui esse consentimento.

## Arrancar

```bash
npm run dev
```

- <http://localhost:3000/> — Dashboard
- <http://localhost:3000/imports> — Histórico de importações
- <http://localhost:3000/qualidade> — Qualidade dos dados
- <http://localhost:3000/kpis> — Catálogo de KPIs
- <http://localhost:3000/api/health> — Saúde da aplicação

## Gerar e importar dados de demonstração

Forma mais rápida de deixar o MVP com dados de ponta a ponta:

```bash
npm run demo:seed
```

Isto regenera `tests/fixtures/demo-agenda.csv`/`.xlsx` a partir do gerador determinístico
(`src/modules/imports/domain/synthetic-dataset.ts`, semente fixa) e importa-os pelo mesmo
caminho de código do ecrã — validação, transação e registo de erros incluídos. É repetível: correr
outra vez dá o mesmo resultado, e a segunda importação é recusada como duplicada (uma
demonstração útil por si só). Para só regenerar as fixtures sem importar: `npm run demo:generate`.

O conjunto gerado cobre de propósito os casos que costumam partir um importador: duas clínicas,
quatro médicos, oito meses de histórico, consultas realizadas/canceladas/faltas/futuras, um mês
inteiro sem dados, consultas exatamente nas fronteiras do mês, IDs duplicados e linhas inválidas
(data inexistente, campos em falta, clínica/médico desconhecidos, estado sem mapeamento, duração
não numérica). Depois de importar, ver `/qualidade` para o relatório completo do que entrou e do
que ficou de fora.

## Demonstrar o fluxo de importação manualmente

1. `npm run dev` e abrir <http://localhost:3000/imports>;
2. clicar em **Importar ficheiro**;
3. escolher `tests/fixtures/agenda-valida.csv` — aparecem os cabeçalhos, o separador detetado, a amostra e o mapeamento sugerido;
4. **Validar** → 6 linhas, 6 válidas, 0 inválidas;
5. **Confirmar importação** → resumo em três vias (aceites/rejeitadas/ignoradas) e ligação para o detalhe do lote;
6. repetir com o mesmo ficheiro → aviso de duplicado na pré-visualização e lote registado como `DUPLICATE`, sem gravar nada;
7. repetir com `tests/fixtures/agenda-com-erros.csv` → 7 linhas inválidas com erro por linha e coluna; confirmar fica bloqueado até assinalar explicitamente "gravar apenas as linhas válidas"; depois de confirmar, descarregar o relatório de erros em CSV;
8. `tests/fixtures/agenda-valida.xlsx` demonstra o mesmo com Excel e duas folhas.

## Demonstrar o dashboard

Depois de importar `tests/fixtures/agenda-dashboard.csv`:

1. abrir <http://localhost:3000/?de=2025-01-01&ate=2025-01-31>;
2. 5 consultas — 2 realizadas, 1 falta, 1 cancelada, 1 por realizar;
3. taxa de realização 50,0 % (denominador 4, não 5: a consulta por realizar não conta);
4. abrir "Como é calculado?" num cartão para ver fórmula, numerador, denominador e versão;
5. filtrar por clínica e ver o denominador acompanhar o filtro;
6. `?de=2025-01-10&ate=2025-01-10` — só uma consulta por realizar: as taxas mostram "sem dados", não 0 %;
7. `?de=2024-01-01&ate=2024-01-31` — período vazio, sem indicadores inventados;
8. abrir "Como é calculado?" e ver também os lotes de origem e a data da última atualização;
9. abrir <http://localhost:3000/qualidade> para o relatório de qualidade dos dados.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Os testes estão em três níveis:

- **unit** (`tests/unit`) — domínio e parsers, sem I/O e sem base de dados; inclui o gerador
  sintético (determinismo e cobertura) e o relatório de erros em CSV;
- **integration** (`tests/integration`) — deduplicação, política de linhas, rollback e
  **isolamento entre organizações**, contra `TEST_DATABASE_URL`;
- **e2e** (`tests/e2e`) — fluxo crítico de importação e do dashboard no browser, com Playwright.

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
scripts/           gerador de dados sintéticos e comando de demonstração
src/app/           páginas, layout e route handlers (sem regras de negócio)
  qualidade/       lotes, rejeições, duplicados, campos em falta, cobertura temporal
src/components/    UI acessível e reutilizável
src/modules/
  imports/         parsing, normalização, validação, commit transacional, relatório de erros,
                   gerador sintético
  kpis/            dinheiro, períodos, rácios, catálogo, cálculo e proveniência dos KPIs
  ai/              contrato neutro de fornecedor + implementação desativada
  organizations/   contexto de organização
src/lib/
  db/              cliente Prisma
  env/             validação de ambiente
  observability/   logging com allowlist de campos
tests/unit/        domínio e parsers, sem I/O
tests/integration/ deduplicação, políticas, rollback e isolamento entre organizações
tests/e2e/         fluxo crítico de importação e do dashboard (Playwright)
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

## Substituir o perfil sintético por um real

Quando chegar uma exportação anonimizada do Newsoft (`prompts/04-real-newsoft-samples.md`):

1. **não editar** `SYNTHETIC_AGENDA_V1`. Criar uma chave nova (ex.: `NEWSOFT_AGENDA_V1`) em
   `src/modules/imports/domain/appointment-profile.ts`, com `isSynthetic: false` e o mapeamento
   real de colunas — cabeçalhos, sinónimos e `statusLabels` a partir da amostra, nunca inventados;
2. o contrato canónico de linha (`domain/contract.ts`) e o validador
   (`domain/validate-appointments.ts`) não mudam: já são neutros em relação ao formato de origem;
3. o esquema, o pipeline de commit, a deduplicação e os KPIs também não mudam — dependem do
   contrato canónico, não do perfil;
4. o ecrã deixa de mostrar "sintético" automaticamente, porque isso vem de
   `importProfile.isSynthetic` gravado com cada lote — nenhuma alteração de UI necessária;
5. rever com o responsável de negócio os denominadores de D-019/D-020 e os estados mapeados,
   porque foram decididos sem uma amostra real;
6. só depois disso um KPI pode passar a `definitionApproved: true`.

Continua bloqueado até lá: qualquer definição de "ativo", "perdido" ou "reativado", e os KPIs de
produção, faturação e orçamentos, que exigem as suas próprias amostras.

## Fase seguinte

`prompts/04-real-newsoft-samples.md` — mapear as exportações reais do Newsoft a partir de amostras anonimizadas, substituindo o perfil sintético. Continua **pendente**: precisa de amostras anonimizadas que ainda não recebemos.
