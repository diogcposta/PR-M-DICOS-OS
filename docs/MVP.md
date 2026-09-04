# MVP 0.1

## Utilizador principal

Gestor ou administrador da clínica que hoje consulta números dispersos no Newsoft e precisa de histórico comparável e indicadores acionáveis.

## Histórias essenciais

1. Como gestor, consigo carregar um Excel/CSV e perceber se o formato é aceite antes de gravar dados.
2. Como gestor, consigo corrigir o mapeamento das colunas e ver erros por linha.
3. Como gestor, consigo confirmar a importação sem criar duplicados.
4. Como gestor, consigo escolher período, clínica e médico.
5. Como gestor, consigo ver KPIs e a comparação com o período anterior.
6. Como gestor, consigo abrir a definição de um KPI e saber de que dados foi calculado.
7. Como gestor, consigo consultar o histórico dos lotes importados.

## Ecrãs

### 1. Dashboard

- filtros: período, clínica e médico;
- cartões de KPI;
- evolução mensal;
- comparação com período anterior;
- estados de carregamento, sem dados e erro;
- ligação para a definição do KPI.

### 2. Importar dados

- seleção do tipo de exportação;
- upload `.xlsx`/`.csv`;
- deteção de folhas/cabeçalhos;
- mapeamento de colunas;
- amostra e validação;
- confirmação;
- resumo de sucesso e falhas.

### 3. Histórico de importações

- ficheiro, hash abreviado, tipo, data, estado e contagens;
- detalhes do mapeamento e erros;
- aviso claro para ficheiro já importado.

### 4. Catálogo de KPIs

- definição, fórmula, unidade, fontes, versão e limitações.

## KPIs iniciais

Só ativar os KPIs cujos campos existam nas exportações reais:

- consultas agendadas;
- consultas realizadas;
- taxa de realização;
- faltas e taxa de faltas;
- cancelamentos e taxa de cancelamento;
- pacientes novos;
- pacientes ativos;
- ativos sem marcação;
- pacientes reativados;
- pacientes inativos/perdidos, após validação da definição;
- produção;
- faturação;
- valor de orçamentos;
- saldo em dívida.

## Critérios de aceitação do MVP

- importar pelo menos um CSV e um XLSX sintéticos;
- bloquear reimportação do mesmo ficheiro;
- indicar linhas inválidas sem perder o contexto da linha;
- calcular corretamente KPIs com testes para intervalos e divisão por zero;
- filtrar por período, clínica e médico;
- manter o histórico após reiniciar a aplicação;
- não depender de qualquer serviço de IA;
- não conter dados pessoais reais.

