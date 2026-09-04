# Registo de decisões

| ID | Decisão | Estado |
|---|---|---|
| D-001 | Monólito modular Next.js + PostgreSQL | aceite para o MVP |
| D-002 | Importação manual Excel/CSV; sem API Newsoft | aceite para o MVP |
| D-003 | KPIs determinísticos e versionados | aceite para o MVP |
| D-004 | IA opcional por interface de fornecedor | aceite para o MVP |
| D-005 | Multi-organização no modelo, mesmo com uma clínica inicial | proposto |
| D-006 | Autenticação a escolher antes de usar dados reais | pendente |
| D-007 | Não guardar o conteúdo do ficheiro: ficam apenas hash, contagens, mapeamento e erros por linha (sem valores de célula) | **aceite** (Fase 2) |
| D-008 | Importação parcial só por escolha explícita do gestor; por omissão uma linha inválida bloqueia o lote | **aceite** (Fase 2) |
| D-009 | Fase 1: PostgreSQL 18 local via Homebrew nesta máquina; `docker-compose.yml` mantido no repositório para quem tenha Docker | aceite |
| D-010 | Prisma 7.10 (estável) em vez de 8.0 RC; convenções v7: `prisma.config.ts` + driver adapter `@prisma/adapter-pg` | aceite |
| D-011 | Catálogo de KPIs em código (`src/modules/kpis/domain/catalog.ts`) com `definitionVersion` persistida, em vez de tabela `KpiDefinition` | aceite |
| D-012 | `(organizationId, fileHash)` é índice e não restrição única, para permitir registar lotes `DUPLICATE` para auditoria; a regra "não reimportar" é aplicada na camada de aplicação | aceite |
| D-013 | Nenhum KPI ativo até a definição ser aprovada; um teste falha de propósito se alguém ativar um sem essa aprovação | aceite |
| D-014 | Sem contexto de organização por sessão enquanto não houver autenticação: usa-se a única organização existente, em vez de simular um utilizador | provisório, depende de D-006 |
| D-015 | `exceljs` para .xlsx e `papaparse` para .csv; sem `xlsx`/SheetJS, que deixou de ser publicado no npm | aceite |
| D-016 | O ficheiro é reenviado do browser em cada passo (pré-visualização, validação, confirmação) e o servidor confirma o hash — consequência direta de D-007: sem conteúdo guardado, não há estado de servidor entre passos | aceite |
| D-017 | Estado da origem sem mapeamento é erro de linha, nunca convertido em `UNKNOWN`: um estado por mapear falsearia a taxa de faltas | aceite |
| D-018 | Clínica ou médico desconhecidos são erro de linha, não criação automática de entidades | aceite |

| D-019 | Denominador das taxas de agenda = consultas com desfecho conhecido (realizadas + faltas + canceladas). Exclui as que ainda estão por acontecer, para um período em curso não mostrar uma taxa de realização artificialmente baixa | aceite (Fase 3), **por validar com o negócio** |
| D-020 | Consultas remarcadas não contam em nenhum total: a consulta conta na data para onde foi movida | aceite (Fase 3) |
| D-021 | Comparação: contagens em variação relativa, percentagens em pontos percentuais — dizer que uma taxa "subiu 50%" ao passar de 10% para 15% seria ambíguo | aceite |
| D-022 | KPIs ativos trazem `definitionApproved: false` até validação do negócio; o ecrã marca-os como "definição provisória" e mostra o que falta decidir | aceite |
| D-023 | Filtros do dashboard vivem no URL (formulário GET), não no estado React: um dashboard filtrado é partilhável e sobrevive ao refresh | aceite |
| D-024 | Gráfico em SVG próprio, sem biblioteca de charts: uma série empilhada e um eixo não justificam a dependência | aceite |

## Dúvidas por resolver

- **Validação das fórmulas de agenda**: as definições de D-019 a D-021 estão implementadas e testadas, mas foram decididas por nós. Precisam de confirmação do responsável de negócio antes de `definitionApproved` passar a `true`.
- **Definições de negócio**: "ativo", "inativo", "perdido" e "reativado" continuam sem definição aprovada. Os KPIs correspondentes estão bloqueados no catálogo.
- **Cancelamentos**: cancelamento pela clínica e pelo paciente contam da mesma forma na taxa? Hoje sim.
- **Produção vs. faturação**: que data usar em cada facto e como tratar reversões e notas de crédito.
- **Amostras reais**: nenhum mapeamento de colunas do Newsoft pode ser fechado antes de recebermos exportações anonimizadas de cada área (10–30 linhas, sem dados pessoais). O perfil `agenda-sintetica` v1 é um andaime, não o mapeamento definitivo.
- **Correção de um lote confirmado**: hoje um lote `COMMITTED` é terminal e corrige-se importando um novo ficheiro. Falta decidir se é preciso anular um lote e o que fazer aos factos que ele criou.

## Notas técnicas conhecidas

- `npm audit` reporta 4 vulnerabilidades altas em dependências transitivas do CLI do Prisma (`mysql2`, `deepmerge-ts`). Não afetam a execução: `mysql2` nunca é carregado num projeto PostgreSQL e o CLI não corre em produção. A correção automática obrigaria a descer para o Prisma 6. Rever quando o Prisma 8 estabilizar.
