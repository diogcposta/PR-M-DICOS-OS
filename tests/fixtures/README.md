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
| `agenda-dashboard.csv` | contagens conhecidas para o e2e do dashboard: janeiro de 2025 com 2 realizadas, 1 falta, 1 cancelada e 1 por realizar, mais 1 realizada em dezembro de 2024 para a comparação |

Cada spec e2e usa a sua própria fixture: partilhar uma faria a segunda importação
ser recusada como duplicada, e o teste falharia por uma razão que não é a que
está a testar.

O `.xlsx` é gerado por `npx tsx tests/fixtures/generate-xlsx.ts` (binário, por isso
não é editável à mão).
