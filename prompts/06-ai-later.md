# Prompt 6 — análises por IA, fase futura

Esta fase não pertence ao MVP base. Só executar depois de importações, KPIs, permissões e política de dados estarem estáveis.

Implementa um primeiro adaptador de IA sem alterar o domínio, as fórmulas de KPI ou os contratos de importação.

- mantém `AIAnalysisProvider` como porta da aplicação;
- escolhe o fornecedor por configuração;
- envia apenas métricas agregadas, definições de KPI e contexto operacional minimizado;
- bloqueia linhas brutas e identificadores pessoais;
- exige resposta estruturada validada por schema;
- inclui evidência numérica em cada observação;
- guarda fornecedor, modelo, versão do prompt, latência e estado, sem guardar dados sensíveis;
- implementa timeout, retry limitado, controlo de custo e fallback para `DisabledAIProvider`;
- os testes não podem depender da rede: usa um provider falso;
- cria uma avaliação com casos sintéticos para detetar números inventados.

Se o primeiro fornecedor for OpenAI, coloca o SDK apenas em `modules/ai/providers/openai` e usa a API atual recomendada na documentação oficial. Nenhum outro módulo pode importar esse SDK.

