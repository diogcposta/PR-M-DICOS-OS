# Arquitetura

## Escolha

Monólito modular full-stack. Um único produto Next.js e uma única base PostgreSQL reduzem operações e velocidade de desenvolvimento. Os módulos mantêm fronteiras que permitem extrair serviços mais tarde, se houver uma necessidade comprovada.

## Fluxo principal

```text
Excel/CSV
  -> parser do ficheiro
  -> linhas em staging
  -> perfil de mapeamento versionado
  -> validação e normalização
  -> pré-visualização + erros
  -> confirmação transacional
  -> factos canónicos em PostgreSQL
  -> consultas de KPI determinísticas
  -> dashboard
```

## Árvore alvo

```text
pr-medicos-os/
├── CLAUDE.md
├── README.md
├── .env.example
├── docker-compose.yml
├── package.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MVP.md
│   ├── KPI_CATALOG.md
│   ├── IMPORT_CONTRACT.md
│   └── DECISIONS.md
├── src/
│   ├── app/
│   │   ├── (dashboard)/page.tsx
│   │   ├── imports/page.tsx
│   │   ├── imports/[id]/page.tsx
│   │   ├── kpis/page.tsx
│   │   └── api/imports/.../route.ts
│   ├── components/
│   │   ├── dashboard/
│   │   ├── imports/
│   │   └── ui/
│   ├── modules/
│   │   ├── imports/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── infrastructure/
│   │   ├── kpis/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── infrastructure/
│   │   └── ai/
│   │       ├── domain/AIAnalysisProvider.ts
│   │       └── providers/disabled/
│   └── lib/
│       ├── db/
│       ├── env/
│       └── observability/
└── tests/
    ├── fixtures/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Modelo de dados inicial

- `Organization`: fronteira de propriedade dos dados.
- `Clinic`: unidade operacional.
- `Practitioner`: médico/profissional com identificador externo opcional.
- `ImportProfile`: mapeamento versionado para um tipo de exportação.
- `ImportBatch`: auditoria e estado de cada ficheiro.
- `ImportRowError`: erros por linha/campo.
- `AppointmentFact`: agenda, estado, data, clínica, médico e paciente pseudonimizado.
- `FinancialFact`: facto monetário com tipo `PRODUCTION`, `INVOICE`, `DEBT` ou outro aprovado.
- `BudgetFact`: orçamento apresentado/aceite quando a exportação o permitir.
- `PatientStatusSnapshot`: contagens ou estado à data, apenas quando a semântica da fonte estiver validada.
- `KpiDefinition`: catálogo/versionamento da definição, ou catálogo equivalente em código com versão persistida.

Não criar uma tabela única “NewsoftData”. O esquema canónico separa os conceitos; os adaptadores absorvem diferenças de formato.

## Segurança desde o início

- dados sintéticos no desenvolvimento;
- ficheiros rejeitados por tipo/tamanho antes do parsing;
- processamento no servidor;
- logs sem conteúdo clínico ou dados pessoais;
- segredos apenas em variáveis de ambiente;
- autorização por `organizationId` em todas as consultas;
- trilho de auditoria dos lotes;
- backups e política de retenção antes de usar dados reais.

## IA desacoplada

```ts
export interface AIAnalysisProvider {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}
```

`AnalysisInput` contém período, filtros, definições e métricas agregadas. `AnalysisResult` contém observações estruturadas, evidências numéricas e avisos. O dashboard funciona com `DisabledAIProvider`; qualquer integração futura é um adaptador de infraestrutura selecionado por configuração.


## Módulo "Produção clínica" (Clinical Production Dashboard)

Acrescentado como um segundo módulo do mesmo monólito (D-033). Mesmas fronteiras:

```text
src/modules/production/
  domain/          cálculos puros: métricas, faltas, planos/follow-up, objetivos,
                   simulador, score, insights, agenda, tempo e formatação (sem Prisma/Next)
  application/     casos de uso: comandos, consultas, validação Zod, CSV, relatório
  infrastructure/  CSV (papaparse) e SHA-256
  demo/            dados sintéticos determinísticos (setembro 2026 = €8.619 / 130,5 h)
src/lib/db/production.ts   cliente Prisma SQLite (adaptador better-sqlite3)
src/app/producao/**        páginas, server actions e rotas de exportação (só composição)
prisma/production/         esquema e migrações SQLite (cliente gerado em src/generated/production)
```

Base própria SQLite (`data/producao.db`), separada da PostgreSQL da clínica: funciona sem servidor.
O esquema usa só tipos portáveis (inteiros em cêntimos, texto para datas civis e enums validados por Zod),
pelo que migrar para PostgreSQL/Supabase é trocar `provider` e adaptador. Definições e fórmulas em
`docs/PRODUCAO.md`.
