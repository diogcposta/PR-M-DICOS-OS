# Prompt 2 — importação com pré-visualização

Lê `CLAUDE.md`, `docs/ARCHITECTURE.md` e `docs/IMPORT_CONTRACT.md`. Confirma que a Fase 1 compila e que os testes passam.

Implementa apenas a Fase 2: pipeline de importação manual, primeiro para um perfil sintético de agenda.

- aceitar `.csv` e `.xlsx` no servidor, com limites de tipo e tamanho;
- calcular SHA-256 e impedir duplicados confirmados;
- listar folhas e cabeçalhos, mostrar 10 linhas de amostra;
- permitir mapear colunas para um contrato canónico de consulta;
- validar datas portuguesas, estados, IDs e campos obrigatórios;
- mostrar erros por linha/campo e contagens válidas/inválidas;
- confirmar o lote numa transação e criar `AppointmentFact` idempotentemente;
- guardar o perfil de mapeamento versionado;
- criar fixtures totalmente sintéticas CSV/XLSX com casos válidos, inválidos e duplicados;
- testar parser, normalizador, deduplicação, rollback e fluxo web crítico.

Não inventes cabeçalhos reais do Newsoft. Identifica claramente o perfil como sintético até recebermos uma exportação anonimizada. No fim, executa lint, tipos e testes e documenta como demonstrar o fluxo.

