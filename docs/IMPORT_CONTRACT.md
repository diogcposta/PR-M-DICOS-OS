# Contrato de importação

## Tipos de exportação

Não assumir que existe um único ficheiro universal. O importador começa com perfis separados, ativados apenas quando houver amostras:

- agenda/consultas;
- produção/faturação;
- orçamentos;
- pacientes/estado;
- saldos em dívida.

## Fases do lote

`UPLOADED -> PARSED -> MAPPED -> VALIDATED -> COMMITTED`

Estados terminais adicionais: `REJECTED`, `FAILED`, `DUPLICATE`.

## Contrato canónico de uma linha

Uma linha validada contém:

- `sourceType`;
- `sourceRecordId` ou `stableRowKey`;
- `occurredAt`/`snapshotDate`;
- `clinicExternalId`;
- `practitionerExternalId`, quando disponível;
- campos específicos do facto;
- `sourceRowNumber`;
- `importBatchId`;
- versão do perfil de mapeamento.

## Política de erros proposta

- Erro estrutural do ficheiro: rejeitar o lote.
- Coluna obrigatória ausente: impedir confirmação.
- Linha inválida: mostrar erro; permitir confirmar apenas linhas válidas se o utilizador escolher explicitamente essa política.
- Valor monetário/data ambíguo: nunca corrigir silenciosamente.
- Ficheiro com hash já confirmado: marcar como duplicado e não gravar factos.

## Amostras necessárias

Antes de fechar mapeamentos reais, obter exportações anonimizadas de cada área, contendo cabeçalhos e 10–30 linhas representativas. Remover nomes, contactos, observações clínicas e outros dados pessoais.

## Estado da adaptação ao Newsoft (Fase 4)

**Pendente.** Continuamos sem uma única amostra real anonimizada do Newsoft. O perfil de agenda em uso, `SYNTHETIC_AGENDA_V1` (`src/modules/imports/domain/appointment-profile.ts`), é inteiramente inventado para fins de demonstração — cabeçalhos, sinónimos e mapeamento de estados incluídos — e marcado como tal (`isSynthetic: true`) em cada lote que o usa. Nenhum destes nomes deve ser lido como uma hipótese sobre o formato real do Newsoft.

A Fase 4A (dados sintéticos avançados) reforça o que já funciona sem tocar no formato: gerador determinístico de dados de demonstração, relatório de erros descarregável, proveniência dos KPIs e página de qualidade dos dados. Ver "Substituir o perfil sintético por um real" em `README.md` para o procedimento a seguir quando as amostras chegarem.

