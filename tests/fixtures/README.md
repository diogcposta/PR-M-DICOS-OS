# Fixtures de importação

Ficheiros **totalmente sintéticos**. Nenhum destes dados vem do Newsoft nem de
qualquer clínica real: os identificadores de clínica e de médico correspondem aos
criados por `npm run db:seed` e as referências de paciente são inventadas.

Os cabeçalhos também são sintéticos. Não representam a exportação real do
Newsoft — essa só será mapeada na Fase 4, a partir de uma amostra anonimizada.

| Ficheiro | Para que serve |
|---|---|
| `agenda-valida.csv` | 6 linhas válidas, incluindo uma no dia da mudança para a hora de verão |
| `agenda-com-erros.csv` | data inexistente, data em falta, estado por mapear, clínica e médico desconhecidos, duração não numérica |
| `agenda-com-repetidas.csv` | linha repetida dentro do próprio ficheiro |
| `agenda-valida.xlsx` | mesmo conteúdo do CSV válido, em Excel, com duas folhas |

O `.xlsx` é gerado por `npx tsx tests/fixtures/generate-xlsx.ts` (binário, por isso
não é editável à mão).
