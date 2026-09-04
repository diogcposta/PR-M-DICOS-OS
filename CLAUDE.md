# Contexto permanente — PR Médicos OS

## Produto

O PR Médicos OS é uma aplicação de gestão analítica para clínicas. Não substitui o Newsoft nem copia o seu dashboard. Recebe exportações manuais Excel/CSV, preserva histórico, calcula KPIs com definições explícitas e destaca áreas onde a gestão deve intervir.

## Objetivo do MVP

Entregar um fluxo completo e fiável:

1. importar ficheiros Newsoft manualmente;
2. pré-visualizar, mapear e validar colunas;
3. gravar factos normalizados e o histórico da importação;
4. consultar um dashboard por período, clínica e médico;
5. comparar com o período anterior;
6. explicar a definição e origem de cada KPI.

## Fora do MVP

- API Newsoft;
- previsões clínicas ou recomendações médicas;
- chat com dados de pacientes;
- automações de marketing/recall;
- faturação, pagamentos ou contabilidade;
- aplicação móvel;
- microserviços;
- IA como requisito para o funcionamento do dashboard.

## Stack preferida

- Next.js com App Router e TypeScript em modo estrito;
- PostgreSQL;
- Prisma ORM;
- Tailwind CSS e componentes acessíveis;
- uma biblioteca madura para Excel/CSV;
- Zod para contratos e validação;
- gráficos React leves;
- Vitest para testes unitários e Playwright para o fluxo crítico.

Usa versões estáveis e compatíveis disponíveis no momento da instalação. Não introduzas dependências sem explicar a necessidade.

## Arquitetura

Construir um monólito modular. A camada web pode chamar serviços de aplicação, mas não deve conter regras de negócio. O domínio não importa Next.js, Prisma, bibliotecas de Excel ou SDKs de IA.

Fronteiras obrigatórias:

- `modules/imports`: parsing, mapeamento, validação, deduplicação e commit;
- `modules/kpis`: definições e cálculo determinístico;
- `modules/ai`: contrato neutro de fornecedor e implementação desativada no MVP;
- `lib/db`: acesso à base de dados;
- `app`: páginas, handlers e composição.

## Regras da importação

- Nunca assumir nomes de colunas Newsoft sem amostra real.
- Criar perfis de mapeamento configuráveis e versionados.
- Suportar `.xlsx` e `.csv`, separador variável, decimal com vírgula e datas `dd/MM/yyyy`.
- Antes de gravar: mostrar cabeçalhos, amostra, mapeamento, contagem válida/inválida e mensagens por linha.
- Cada ficheiro recebe SHA-256. Reimportar o mesmo ficheiro não pode duplicar dados.
- Preferir ID externo do registo; se não existir, criar uma chave estável documentada a partir de campos normalizados.
- A gravação final é transacional: ou entra o lote válido segundo a política definida, ou o estado fica coerente.
- Guardar `ImportBatch`, nome original, hash, tipo de dados, perfil/mapeamento, contagens, estado, timestamps e erros.
- Preservar a linha original em JSON apenas quando necessário para auditoria, com retenção e acesso restritos.
- Nunca registar nomes, contactos ou conteúdo de ficheiros em logs.

## Regras dos dados

- Dinheiro: inteiros em cêntimos, nunca `float`.
- Tempo: instantes em UTC e contexto de negócio `Europe/Lisbon`.
- Todas as tabelas de negócio incluem `organizationId`; manter `clinicId` quando aplicável.
- Evitar dados pessoais no MVP. Quando um identificador de paciente for necessário, usar ID externo pseudonimizado.
- Não misturar produção, faturação, cobrança e orçamento; são factos e KPIs diferentes.
- Não interpretar “ativo”, “inativo”, “perdido” ou “reativado” sem uma definição aprovada.

## KPIs

- Cada KPI tem `key`, nome, descrição, fórmula, unidade, fontes, filtros suportados e versão da definição.
- O resultado deve poder explicar numerador, denominador, período e lote(s) de origem.
- Divisão por zero devolve `null`/“sem dados”, nunca 0% enganador.
- Comparações usam período anterior de duração equivalente e calendário explicitamente testado.
- KPIs não dependem de IA.

## IA futura

Definir apenas o contrato `AIAnalysisProvider` e uma implementação `DisabledAIProvider` no MVP. Nenhum SDK de IA deve ser importado pelo domínio ou pelos módulos de KPIs/importação.

O contrato recebe um `AnalysisInput` com métricas agregadas e devolve um `AnalysisResult` estruturado. O fornecedor é escolhido por configuração. Uma futura implementação OpenAI deve ficar em `modules/ai/providers/openai` e poderá usar a Responses API com saída estruturada. Nunca enviar nomes, contactos, notas clínicas ou linhas brutas de pacientes para um fornecedor de IA.

## Qualidade e modo de trabalho

- Trabalhar numa fase de cada vez.
- Antes de alterar, ler os ficheiros relevantes e apresentar um plano curto.
- Não inventar requisitos para desbloquear dúvidas importantes; registar a dúvida em `docs/DECISIONS.md`.
- Criar dados sintéticos, nunca dados reais.
- Depois de cada fase: executar lint, verificação de tipos e testes relevantes.
- Fazer commits pequenos apenas quando pedido.
- Atualizar documentação quando uma decisão muda.

## Definição de concluído

Uma fase só termina quando o código compila, os testes relevantes passam, o caminho feliz pode ser demonstrado e os erros são apresentados em linguagem compreensível.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
