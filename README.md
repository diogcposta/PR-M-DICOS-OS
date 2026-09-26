# PR Médicos OS — Clinical Production Dashboard

Aplicação web local para um médico dentista perceber e melhorar a sua produção clínica:
quanto produz por hora e por dia, quanto recebe, onde perde capacidade (faltas, horas vazias),
que procedimentos e convenções rendem mais ou menos por hora, que planos de tratamento não
avançaram e que mudanças **operacionais** têm mais impacto — sem aumentar horas e sem
incentivar sobretratamento.

- Sem dados identificáveis de pacientes: só **Case IDs** (`DC-2026-001`).
- Sem serviços pagos nem IA externa: tudo corre no seu computador, com uma base SQLite local.
- Indicadores operacionais/económicos — **não medem qualidade clínica**.

> O repositório contém também o módulo **Clínica** (importações Newsoft, PostgreSQL), documentado
> em [`docs/CLINICA.md`](docs/CLINICA.md). O dashboard de produção não depende dele.

---

## Começar em 3 passos

Requisitos: **Node.js 20.19+ ou 22+** (macOS: `brew install node`). Nada mais.

```bash
npm install
npm run producao:setup     # cria a base local e carrega dados de demonstração
npm run dev                # abre em http://localhost:3000
```

Abra **http://localhost:3000/producao** (ou apenas http://localhost:3000). No iPad/iPhone na mesma
rede Wi-Fi, use o endereço "Network" que o `npm run dev` mostra (ex.: `http://192.168.1.20:3000`).

Os dados de demonstração são sintéticos: setembro de 2026 com **€8.619** de produção, **€4.309,50**
de honorários, **130,5 h** clínicas (≈ **66,05 €/h**) e dois dias clínicos ainda previstos, mais
abril–agosto para as tendências.

### Começar com os seus dados

1. **Definições** → confirme nome, percentagem (50%), horário, objetivos e regras de follow-up.
2. Apague a demonstração: `npm run producao:seed` recarrega-a; para uma base vazia apague
   `data/producao.db` e corra `npm run producao:migrate` (o perfil é recriado com os valores iniciais).
3. Todos os dias: **Dias clínicos** → registar o dia; **+ Registar** → procedimentos.

---

## Utilização diária

| Tarefa | Onde | Dica |
|---|---|---|
| Registar o dia | Dias clínicos | O horário habitual vem pré-preenchido. *Previsto* = só conta na projeção. |
| Registar um procedimento (< 20 s) | **+ Registar** (atalho **N**) | Escreva o tipo: preço, duração, pagador e laboratório habituais preenchem-se. ★ favoritos, "Copiar último", **⌘/Ctrl + Enter** grava e prepara o seguinte a começar onde este acabou. |
| Tratamento em várias consultas | Página do procedimento → *Adicionar consulta* | A receita é uma só; o tempo soma-se. Use o mesmo Case ID para vários procedimentos do mesmo caso. |
| Faltas | Faltas | Indique se o slot foi recuperado e a receita da lista de espera. |
| Planos | Planos | Lista automática de follow-up; "Contactado hoje" reinicia a contagem. |
| Ver o dia | Agenda (atalho **A**) | Slots de 30/45/60/90/120 min sobre o horário, com consultas e faltas. |
| Decidir | Dashboard (atalho **D**), Rentabilidade, Seguros, Tendências, What if?, Relatório | |

## Funcionalidades

- **Dashboard**: produção, honorários, horas, €/h, €/dia, atos, agendamentos, faltas, taxa de faltas,
  receita perdida, planos apresentados/aceites, taxa de aceitação, pendentes; variação face ao mês
  anterior; projeção de fim de mês.
- **Produção atual vs objetivos** (85/100/125/150 €/h editáveis): produção e honorários projetados com
  as mesmas horas e distância ao próximo objetivo (ex.: 66 → 85 €/h = +19 €/h, +28,8%).
- **Rentabilidade**: €/h, produção líquida, honorários e honorários/h por procedimento; matriz
  ordenável (maior/menor €/h, faturação, casos); top 5 mais e menos produtivos; €/h por categoria;
  procedimentos abaixo do objetivo; **casos multi-procedimento** com deteção de "valor elevado,
  €/h baixo" (ex.: retratamento + coroa = €800 em 7 h ≈ €114/h).
- **Particular vs seguros/convenções**: por procedimento e por seguradora, comparando a mesma mistura
  de procedimentos; desconto face à tabela e impacto mensal.
- **Faltas**: horas perdidas, receita potencial/recuperada/líquida perdida, % da agenda perdida,
  gráfico produção real vs potencial.
- **Planos**: funil diagnóstico → apresentado → aceite → iniciado → concluído (valor e casos, maior
  perda destacada), follow-up automático (> €500 sem consulta, > €1.500 prioritário, 7/30 dias sem
  resposta), tratamentos que não avançaram. Sem mensagens a pacientes.
- **Agenda e eficiência**: horas disponíveis, marcadas, trabalhadas, perdidas, vazias; ocupação
  teórica vs real.
- **What if?** e **cenários** (Atual, Meta 12 meses, Meta longo prazo): horas, €/h, %, faltas,
  aceitação e valor médio dos planos → produção e honorários mensais e anuais.
- **Tendências** (12 meses): produção, honorários, €/h, horas, produção/dia, faltas, receita perdida,
  planos, aceitação, valor médio por caso — mês vs anterior e média móvel de 3 meses.
- **Insights automáticos** por regras (sem IA) e **Clinical Efficiency Score** 0–100 (operacional).
- **Relatório mensal** com as 3 ações de maior impacto; imprimir/guardar PDF pelo browser; Markdown.
- **Exportar** tudo em CSV (Excel PT: `;`, BOM, `dd/mm/aaaa`); **importar** CSV com pré-visualização,
  erros por linha, SHA-256 contra reimportação e gravação transacional.
- Modo **claro/escuro** (botão no cabeçalho; por omissão segue o sistema); responsivo MacBook/iPad/iPhone.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run producao:setup` | Gera os clientes Prisma, aplica migrações SQLite e carrega a demonstração se a base estiver vazia (idempotente) |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:3000 |
| `npm run producao:seed` | Recarrega os dados de demonstração (apaga os registos; mantém definições) |
| `npm run producao:migrate` | Aplica migrações pendentes à base local |
| `npm run producao:studio` | Prisma Studio sobre a base local |
| `npm run test:producao` | Testes unitários + testes da aplicação contra SQLite temporário |
| `npm run test:e2e:producao` | Playwright: fluxo crítico (desktop) e responsividade (iPhone). Em ambientes sem browsers descarregados: `PLAYWRIGHT_CHROMIUM_PATH=/caminho/chromium` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript estrito |
| `DATABASE_URL=… npm run build && npm start` | Build de produção (o módulo Clínica exige `DATABASE_URL` no build; qualquer URL PostgreSQL serve se não o usar) |

Testes do módulo Clínica (PostgreSQL): ver [`docs/CLINICA.md`](docs/CLINICA.md#qualidade).

## Arquitetura

Monólito modular Next.js (App Router, TypeScript estrito). A web só compõe; as regras vivem no domínio.

```text
src/modules/production/
  domain/          cálculos puros e testados (sem Next, Prisma ou bibliotecas de ficheiros)
    metrics.ts     procedimento, matriz, casos, particular vs seguros, convenções
    monthly.ts     resumo do mês, faltas, eficiência da agenda, planos
    plans.ts       follow-up e funil       goals.ts / simulator.ts / score.ts / trends.ts
    insights.ts    insights e ações por regras      agenda.ts / time.ts / format.ts
  application/     casos de uso: comandos (transações, sobreposições), consultas, Zod, CSV, relatório
  infrastructure/  CSV (papaparse) e SHA-256
  demo/            dados sintéticos determinísticos
src/lib/db/production.ts     cliente Prisma SQLite
src/app/producao/            páginas, server actions, rotas de exportação
src/components/production/   UI (Tailwind), gráficos (Recharts), formulários
prisma/production/           esquema e migrações
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, Prisma 7 + SQLite
(`better-sqlite3`), Zod, Vitest, Playwright. Sem shadcn/ui: componentes próprios acessíveis com
Tailwind, sem dependências Radix (D-047). Decisões em [`docs/DECISIONS.md`](docs/DECISIONS.md)
(D-033 a D-051) e dúvidas em aberto na mesma página.

### Base de dados

SQLite em `data/producao.db` (fora do git). Tabelas: `doctor_profiles`, `schedule_blocks`,
`production_goals`, `scenarios`, `clinical_days`, `clinical_cases`, `procedures`,
`procedure_sessions`, `procedure_templates`, `absence_events`, `treatment_plans`,
`production_imports`. Todas as tabelas de negócio têm `doctorId`.

- Dinheiro: inteiros em **cêntimos**; percentagens em **pontos-base**.
- Datas: data civil `yyyy-MM-dd` (Europe/Lisbon); horas: minutos desde a meia-noite.
- Enums como texto validado por Zod → esquema portável.

**Migrar para PostgreSQL/Supabase**: em `prisma/production/schema.prisma` trocar `provider = "sqlite"`
por `"postgresql"`, em `src/lib/db/production.ts` trocar `PrismaBetterSqlite3` por `PrismaPg`,
gerar uma migração nova, exportar os CSV (Importar/Exportar) e importá-los na nova base.

**Cópia de segurança**: copiar `data/producao.db`, ou exportar os 4 CSV.

## Principais fórmulas

Detalhe completo em [`docs/PRODUCAO.md`](docs/PRODUCAO.md).

- €/h (dashboard) = produção ÷ horas clínicas (dias realizados, sem pausas).
- €/h de um procedimento = valor faturado ÷ horas de cadeira de **todas** as suas consultas.
- Honorários = produção × % (base configurável); produção líquida = faturado − laboratório − outros custos.
- Taxa de faltas = (faltas + cancelamentos tardios) ÷ (consultas realizadas + essas faltas).
- Receita líquida perdida = valor estimado das faltas − receita recuperada pela lista de espera.
- Ocupação teórica = (trabalhado + perdido) ÷ disponível; real = trabalhado ÷ disponível.
- Aceitação = valor aceite ÷ valor apresentado.
- Divisão por zero → "sem dados", nunca 0%.

## Verificações feitas

Testes automáticos cobrem: cálculos financeiros e honorários (arredondamento único), divisões por
zero, consultas sobrepostas (recusadas; união no cálculo de ocupação), tratamentos com várias
consultas e casos multi-procedimento, custos de laboratório e margem, faltas e receita recuperada,
alteração da percentagem médica, follow-up e funil, simulador, score, insights (incluindo a regra de
não prescrever tratamentos), importação/exportação com reprodução exata dos números, persistência
dos dados entre ligações, e responsividade/ausência de erros em largura de iPhone.

## Roadmap

1. Validar com o médico as definições marcadas "por validar" (`docs/DECISIONS.md`).
2. Adaptador de importação Newsoft (quando houver exportações reais anonimizadas).
3. PDF gerado no servidor para o relatório mensal (hoje: imprimir/guardar PDF no browser).
4. Autenticação e migração para PostgreSQL/Supabase para acesso fora de casa.
5. Duração real vs slot marcado (para medir derrapagens da agenda de 45 min).
6. Metas por mês e alertas quando a projeção fica abaixo do objetivo.
7. Opcional: análise por IA através de `AIAnalysisProvider` apenas com métricas agregadas.
