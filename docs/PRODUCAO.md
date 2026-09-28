# Clinical Production Dashboard — definições e fórmulas

Todas as fórmulas vivem em `src/modules/production/domain/` e têm testes em
`tests/unit/production/`. Dinheiro em cêntimos inteiros; percentagens em pontos-base
(5000 = 50%); divisão por zero devolve **"sem dados"**, nunca 0%.

## Registos

| Registo | O que é |
|---|---|
| Dia clínico | Data, início, fim, pausa; estado *realizado* ou *previsto*. |
| Procedimento | Um ato com **uma** receita: tipo, categoria, valor tabelado, valor faturado, pagador (particular / seguro / convenção + nome), consultas previstas, laboratório, outros custos, observação operacional, concluído. |
| Consulta (sessão) | Tempo de cadeira de um procedimento: data, início, fim. Uma coroa em 3 consultas = 1 procedimento + 3 consultas. |
| Case ID | Agrupador anónimo (`DC-2026-001`) de procedimentos e planos. Nunca nomes ou números de utente. |
| Falta | Data, hora, duração prevista, procedimento previsto, valor estimado, pagador, tipo (falta / cancelamento tardio / cancelamento antecipado), slot recuperado, receita recuperada. |
| Plano | Case ID, data de apresentação, valor diagnosticado, valor total, fases, estado, valor aceite, valor realizado, último contacto, próxima consulta marcada. |

## Produção e horas

| Indicador | Fórmula |
|---|---|
| Produção do mês | Σ valor faturado dos procedimentos com data no mês |
| Honorários | Produção × percentagem (base configurável: faturado, ou faturado − laboratório − outros custos); um único arredondamento |
| Horas clínicas | Σ (fim − início − pausa) dos dias **realizados** |
| Produção por hora (€/h clínico) | Produção ÷ horas clínicas |
| Produção por dia | Produção ÷ dias realizados |
| Atos | N.º de procedimentos com data no mês |
| Agendamentos | N.º de consultas realizadas no mês |
| Projeção fim do mês | Produção + €/h × horas dos dias **previstos** |
| Valor médio por caso | Produção dos procedimentos com Case ID ÷ n.º de Case IDs |

Exemplo (dados de demonstração): €8.619 ÷ 130,5 h = **66,05 €/h**; honorários €8.619 × 50% = **€4.309,50**.

## Exames (versão Apps Script)

Ortopantomografias, CBCT e outros exames dos pacientes do médico, feitos na clínica (D-059).

| Indicador | Fórmula |
|---|---|
| Honorários dos exames | Σ (valor do exame × percentagem), um arredondamento ao cêntimo por exame; a base NET não se aplica (sem custos diretos) |
| Total a receber | Honorários dos atos + honorários dos exames do mês |

Os exames **não** entram na produção do mês, no €/hora, nos atos nem nos objetivos: não usam tempo de cadeira do médico.
Exemplo: CBCT €80 + ortopantomografia €30 a 50% = **€55**; com a demonstração, total a receber €4.309,50 + €55 = **€4.364,50**.

## Fecho do mês (versão Apps Script)

| Indicador | Fórmula |
|---|---|
| Honorários estimados | Valor pago pelos pacientes × percentagem (atos) + honorários dos exames |
| Recebido | Total da folha de honorários gravado no fecho do mês (atos e exames) |
| Diferença | Recebido − estimado (só em meses com registos) |
| Recebido por hora | Recebido ÷ horas clínicas do mês |
| Meses do histórico | Sem registos diários: produção, horas e €/h vêm do fecho; honorários = recebido |

Exemplo (demonstração): estimado €4.309,50; folha de honorários €4.400 → diferença **+€90,50**.

## Rentabilidade

| Indicador | Fórmula |
|---|---|
| Tempo de cadeira | Σ duração das consultas do procedimento |
| €/h do procedimento | Valor faturado ÷ horas de cadeira |
| Produção líquida da clínica | Faturado − laboratório − outros custos diretos |
| Honorários/h | Honorários ÷ horas de cadeira |
| Baixa produtividade | €/h abaixo do objetivo mais baixo (85 €/h por omissão) |
| Matriz por procedimento | Casos, receita, tempo, €/h (só atos com tempo), honorários/h, custos, margem |
| Caso (Case ID) | Receita total ÷ tempo total de todas as consultas de todos os procedimentos |
| Caso de valor elevado com €/h baixo | Valor ≥ €500 e €/h < 75% da média ponderada dos casos de valor elevado |

Exemplos: coroa €600 em 90 + 45 + 45 min → **€200/h**; retratamento €200 em 4 h → **€50/h**
(honorários €100, **€25/h**); retratamento + coroa = €800 em 7 h → **≈ €114/h** (assinalado).

## Seguros e convenções

| Indicador | Fórmula |
|---|---|
| €/h particular vs seguro (por procedimento) | Receita ÷ horas de cadeira em cada grupo; diferença absoluta e % face ao particular |
| €/h particular equivalente (por seguradora) | Σ (€/h particular do mesmo procedimento × minutos do seguro) ÷ minutos — mesma mistura de procedimentos |
| Desconto face à tabela | Σ (valor tabelado − valor faturado) nos atos com seguro/convenção |
| Impacto no tempo | Σ (€/h particular do procedimento × horas do ato) − faturado |

## Faltas e agenda

| Indicador | Fórmula |
|---|---|
| Faltas | Faltas + cancelamentos tardios (antecipados à parte) |
| Taxa de faltas | Faltas ÷ (consultas realizadas + faltas) |
| Horas perdidas | Duração das faltas cuja vaga **não** foi recuperada |
| Receita potencial perdida | Σ valor estimado das faltas |
| Receita recuperada | Σ receita de quem ocupou a vaga (lista de espera) |
| Receita líquida perdida | Potencial − recuperada (mínimo 0) |
| % da agenda perdida | Horas perdidas ÷ horas clínicas |
| Horas trabalhadas | União das consultas de cada dia (sobreposições contam uma vez) |
| Horas marcadas | Trabalhadas + perdidas por faltas |
| Horas vazias | Disponíveis − marcadas |
| Ocupação teórica / real | Marcadas ÷ disponíveis / trabalhadas ÷ disponíveis |

## Planos

| Indicador | Fórmula |
|---|---|
| Taxa de aceitação | Valor aceite ÷ valor apresentado (também por número de planos) |
| Pendente de realizar | Σ (aceite − realizado) dos planos não rejeitados |
| Não avançou | Σ (total − aceite) |
| Funil | Diagnosticado → apresentado → aceite → iniciado (aceite dos planos com realizado > 0) → concluído (realizado dos concluídos). Maior perda = passo com maior diferença em euros |
| Follow-up | Planos em aberto sem próxima consulta: > €500 → follow-up; > €1.500 → prioritário; sem resposta ≥ 7 dias → alerta; ≥ 30 dias → 2.º alerta |

## Objetivos, simulador, score

- **Objetivos**: produção projetada = objetivo €/h × horas clínicas do mês; diferença para o próximo objetivo em €/h e % (66 → 85 €/h: +19 €/h, +28,8%).
- **Simulador**: produção = horas × €/h × (1 − faltas novas) ÷ (1 − faltas atuais); honorários = produção × %; anual = mensal × meses de trabalho; valor aceite/mês = planos × valor médio × aceitação (mostrado à parte).
- **Clinical Efficiency Score (0–100)**: €/h vs objetivo principal (30%), ocupação real (20%), faltas (15%: 0% → 100, ≥ 20% → 0), aceitação (15%), utilização do horário (10%), follow-up em dia (10%). Componentes sem dados excluídos. **Indicador operacional/económico — não mede qualidade clínica.**

## Princípio central

Nenhuma regra recomenda fazer mais ou menos de um tratamento. Insights e ações descrevem números e
propõem melhorias operacionais (agenda, faltas, follow-up, tempos, tabela de preços/convenções). A
decisão clínica pertence sempre ao médico.
