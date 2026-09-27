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

| D-025 | Perfil renomeado de `agenda-sintetica` para `SYNTHETIC_AGENDA_V1`, explicitamente sem a palavra "Newsoft" em lado nenhum do código, para não sugerir uma correspondência que não existe | aceite (Fase 4A) |
| D-026 | Gerador de dados sintéticos com PRNG semeado (congruencial linear), não `Math.random()`: a mesma semente tem de produzir sempre o mesmo ficheiro, porque o importador identifica ficheiros por SHA-256 | aceite (Fase 4A) |
| D-027 | Os carimbos temporais do contentor ZIP do `.xlsx` gerado são normalizados para uma data fixa (1980-01-01, o mínimo do formato DOS): o ExcelJS produz conteúdo determinístico, mas grava a hora de escrita no ZIP, o que mudava o hash a cada geração | aceite (Fase 4A) |
| D-028 | Resultado da confirmação em três vias — `rowsAccepted`/`rowsRejected`/`rowsIgnored`, que somam sempre `rowsTotal` — em vez de `rowsCommitted`/`rowsSkipped`: "ignorada por já existir" e "rejeitada por erro" são motivos diferentes e o gestor precisa de os distinguir | aceite (Fase 4A) |
| D-029 | Relatório de erros descarregável em CSV com `;`, CRLF e BOM UTF-8 (para abrir corretamente no Excel português) e neutralização de valores que comecem por `=`, `+`, `-` ou `@` (para o Excel não os executar como fórmula) | aceite (Fase 4A) |
| D-030 | Cada resultado de KPI carrega proveniência completa: versão da definição, período e período de comparação, filtros aplicados (nomes, não IDs), numerador, denominador, lotes de origem e data da última atualização | aceite (Fase 4A) |
| D-031 | Página `/qualidade` como fonte única de verdade sobre o estado dos dados: lotes, motivos de rejeição agregados, campos opcionais em falta e meses sem dados dentro do intervalo coberto | aceite (Fase 4A) |
| D-032 | Testes de isolamento entre organizações usam deliberadamente os mesmos identificadores externos (`CLINIC-001`, `DOCTOR-001`) nas duas organizações de teste, para provar que o isolamento vem da chave composta `(organizationId, externalId)` e não de identificadores que por acaso não colidem | aceite (Fase 4A) |

| D-033 | Clinical Production Dashboard como módulo `modules/production` do mesmo monólito, com base **SQLite** própria (Prisma 7 + `@prisma/adapter-better-sqlite3`), separada da PostgreSQL da clínica. Pedido explícito do médico: local, gratuito, sem servidor. Esquema portável para PostgreSQL/Supabase | aceite |
| D-034 | Datas de negócio do módulo de produção como data civil `yyyy-MM-dd` e horas como minutos desde a meia-noite (Europe/Lisbon implícito): são registos manuais, não instantes de outro sistema; evita conversões de fuso e erros de DST. `createdAt`/`updatedAt` continuam em UTC | aceite |
| D-035 | Um procedimento tem **uma** receita e N consultas (sessões). €/h do procedimento = faturado ÷ Σ duração das consultas. Casos (Case ID) agregam procedimentos. Nunca se divide a receita por consulta | aceite |
| D-036 | Dois €/h distintos e sempre rotulados: **€/h clínico** (produção ÷ horas dos dias clínicos, inclui tempo sem marcação — é o do dashboard e dos objetivos) e **€/h de cadeira** (receita ÷ horas de consulta — rentabilidade por procedimento) | aceite |
| D-037 | A produção conta na data do procedimento (não na data de cada consulta). O tempo de cadeira de um procedimento conta inteiro no seu €/h, mesmo que as consultas atravessem meses; a ocupação da agenda usa as datas reais das consultas | aceite |
| D-038 | Honorários = produção × percentagem, com **um único arredondamento** sobre o total do mês. Base configurável: faturado (omissão, como pedido) ou faturado − custos diretos | aceite; ver dúvida abaixo |
| D-039 | "Faltas" = faltas + cancelamentos tardios; cancelamentos antecipados ficam fora da taxa (houve tempo para reocupar). Taxa = faltas ÷ (consultas realizadas + faltas). Horas perdidas = duração das faltas não recuperadas. Receita líquida perdida = estimada − recuperada (nunca negativa) | aceite, **por validar com o médico** |
| D-040 | Ocupação teórica = (trabalhado + perdido por faltas) ÷ disponível; real = trabalhado ÷ disponível; trabalhado = união das consultas de cada dia (sobreposições contam uma vez) e só em dias com registo | aceite |
| D-041 | Consultas sobrepostas no mesmo dia são **recusadas** ao gravar (mensagem indica a consulta em conflito) | aceite |
| D-042 | Taxa de aceitação principal por valor (aceite ÷ apresentado), também mostrada por número; denominador = todos os planos apresentados no período, incluindo os ainda sem decisão | aceite, **por validar** |
| D-043 | Follow-up: só planos em aberto sem próxima consulta marcada; > €500 → follow-up; > €1.500 → prioritário; sem resposta ≥ 7 / ≥ 30 dias desde o último contacto (ou apresentação) → 1.º / 2.º alerta. Limiares editáveis. Sem mensagens a pacientes | aceite |
| D-044 | Clinical Efficiency Score: média ponderada de 6 componentes 0–1 (€/h vs objetivo 30, ocupação real 20, faltas 15, aceitação 15, utilização do horário 10, follow-up 10); componentes sem dados são excluídos e os pesos renormalizados. Rotulado como indicador operacional, nunca de qualidade clínica | aceite |
| D-045 | Insights e ações por regras determinísticas, com frases descritivas ("X apresenta A €/h vs média B €/h"). Um teste proíbe linguagem prescritiva de tratamentos | aceite |
| D-046 | Simulador: €/h por hora clínica que já reflete a taxa de faltas atual; mudar as faltas escala o €/h por (1 − nova)/(1 − atual). Valor aceite de planos mostrado à parte, não somado à produção (contaria duas vezes as mesmas horas). Anual = mensal × meses de trabalho (11 por omissão, editável) | aceite |
| D-047 | Sem shadcn/ui: componentes próprios com Tailwind e elementos nativos acessíveis (o shadcn exigiria Radix, cva, tailwind-merge e o CLI para ~10 componentes simples). Recharts para os gráficos (pedido; justifica-se com 10+ gráficos com tooltip) — substitui D-024 só neste módulo | aceite |
| D-048 | Formatação monetária fixa `€8.619` / `€4.309,50` (convenção pedida) em vez de `Intl` pt-PT (`8619,00 €`): igual no servidor e no browser, sem avisos de hidratação | aceite |
| D-049 | Importação CSV do módulo de produção por adaptadores (`ImportSource`); hoje só o formato nativo (= exportação). Pré-visualização, SHA-256, transação única, lote bloqueado por linhas inválidas salvo escolha explícita (D-008), linhas com `id` existente ignoradas | aceite |
| D-050 | Texto livre (observações, seguradora) recusa emails e números de telefone/utente; Case ID validado (`DC-2026-001`) | aceite |
| D-051 | `/` redireciona para `/producao` quando `DATABASE_URL` não está definido, para o médico usar o dashboard sem instalar PostgreSQL | aceite |
| D-052 | Versão **Google Apps Script** (pedido do médico: "funcionar no Apps Script" e acessível no iPhone): aplicação web HtmlService + Google Sheets como base de dados, na conta do médico, implementação "Executar como eu / Apenas eu". Resolve a dúvida anterior sobre "appscripts" | aceite |
| D-053 | Um só domínio para as duas versões: a composição dos ecrãs passou para `domain/views.ts` (puro), usada pela app Next e pelo cliente Apps Script; validação com os mesmos esquemas Zod. Nenhuma fórmula duplicada | aceite |
| D-054 | No Apps Script, o servidor só valida e grava; os cálculos correm no browser (iPhone) sobre todos os registos. Uma ida ao servidor por ação (a resposta traz os dados atualizados), JSON explícito, operação única `api(nome, args)` com lista fechada de operações, `LockService` nas escritas | aceite |
| D-055 | Folha com cabeçalhos em português lidos pelo nome; datas e horas como texto (`aaaa-mm-dd`, `HH:mm`, formato `@`) para o Sheets não as converter em datas; booleanos como "sim"/"não"; dinheiro em cêntimos. A leitura tolera datas convertidas e `dd/mm/aaaa` editados à mão | aceite |
| D-056 | Build com esbuild para 4 ficheiros copiáveis (`Codigo.gs`, `Servidor.gs`, `Index.html`, `appsscript.json`) versionados em `apps-script/dist/`: o médico instala sem Node.js; um teste falha se `dist/` estiver desatualizado. Traduções do Zod excluídas do bundle (mensagens são próprias) | aceite |
| D-057 | Cliente sem framework (HTML escapado + SVG próprio): página única de ~120 KB, rápida no iPhone; campos a 16 px (sem zoom do Safari), barra inferior com áreas seguras, tema claro/escuro do sistema. Pré-visualização local com folha simulada para testes E2E | aceite |

## Dúvidas por resolver

### Clinical Production Dashboard

- ~~"A aplicação deve funcionar no appscripts"~~ — confirmado: Google Apps Script, acessível no iPhone. Resolvido em D-052.
- **Importação CSV na versão Apps Script**: não existe (os dados podem ser colados diretamente na folha, respeitando os cabeçalhos). Acrescentar se for preciso migrar da versão local.
- **Base dos honorários**: o pedido diz "produção × 50%". Em muitas clínicas o laboratório é descontado antes da percentagem. A base é configurável (D-038); confirmar qual se aplica ao contrato.
- **Faltas**: confirmar que cancelamentos antecipados não contam como falta e que os tardios contam (D-039).
- **Taxa de aceitação**: planos ainda sem decisão contam no denominador (D-042) — num mês em curso a taxa parece baixa.
- **Data da produção**: hoje é a data do procedimento (1.ª consulta). Se a clínica fatura na conclusão, a produção deve passar para a data da última consulta.

### Módulo Clínica

- **Validação das fórmulas de agenda**: as definições de D-019 a D-021 estão implementadas e testadas, mas foram decididas por nós. Precisam de confirmação do responsável de negócio antes de `definitionApproved` passar a `true`.
- **Definições de negócio**: "ativo", "inativo", "perdido" e "reativado" continuam sem definição aprovada. Os KPIs correspondentes estão bloqueados no catálogo.
- **Cancelamentos**: cancelamento pela clínica e pelo paciente contam da mesma forma na taxa? Hoje sim.
- **Produção vs. faturação**: que data usar em cada facto e como tratar reversões e notas de crédito.
- **Amostras reais**: nenhum mapeamento de colunas do Newsoft pode ser fechado antes de recebermos exportações anonimizadas de cada área (10–30 linhas, sem dados pessoais). O perfil `SYNTHETIC_AGENDA_V1` é um andaime, não o mapeamento definitivo — ver "Substituir o perfil sintético por um real" no README.
- **Correção de um lote confirmado**: hoje um lote `COMMITTED` é terminal e corrige-se importando um novo ficheiro. Falta decidir se é preciso anular um lote e o que fazer aos factos que ele criou.

## Notas técnicas conhecidas

- `npm audit` reporta 4 vulnerabilidades altas em dependências transitivas do CLI do Prisma (`mysql2`, `deepmerge-ts`). Não afetam a execução: `mysql2` nunca é carregado num projeto PostgreSQL e o CLI não corre em produção. A correção automática obrigaria a descer para o Prisma 6. Rever quando o Prisma 8 estabilizar.
