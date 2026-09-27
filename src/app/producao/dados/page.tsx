import { ImportPanel } from "@/components/production/ImportPanel";
import { btnSecondary, card, PageTitle, Section, TableWrap, td, th } from "@/components/production/ui";
import { ENTITIES, ENTITY_LABELS, entityHeaders, listImports } from "@/modules/production/application/data-transfer";
import { defaultMonth } from "@/modules/production/application/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar e exportar" };

export default async function DataPage() {
  const [imports, month] = await Promise.all([listImports(), defaultMonth()]);
  return (
    <div className="space-y-10">
      <PageTitle title="Importar e exportar" description="CSV compatível com o Excel português. Os dados ficam na base local; nada é enviado para serviços externos." />

      <Section title="Exportar" description="Um ficheiro por tipo de dados. O formato é o mesmo que a importação aceita (cópia de segurança e migração).">
        <div className={`${card} flex flex-wrap gap-2 p-5`}>
          {ENTITIES.map((e) => (
            <a key={e} href={`/producao/exportar/${e}`} className={btnSecondary} download>⤓ {ENTITY_LABELS[e]}</a>
          ))}
          <a href={`/producao/relatorio/exportar?mes=${month}`} className={btnSecondary} download>⤓ Relatório mensal (.md)</a>
        </div>
      </Section>

      <Section title="Importar CSV" description="Pré-visualize antes de gravar: cabeçalhos, amostra, linhas válidas e inválidas. O mesmo ficheiro nunca é importado duas vezes; linhas com um id já existente são ignoradas.">
        <ImportPanel entities={ENTITIES.map((e) => ({ key: e, label: ENTITY_LABELS[e], headers: entityHeaders(e) }))} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Newsoft: a integração não existe nesta fase. A importação usa adaptadores de fonte; um adaptador Newsoft será
          acrescentado quando houver exportações reais anonimizadas para mapear as colunas (nunca assumidas sem amostra).
        </p>
      </Section>

      {imports.length > 0 ? (
        <Section title="Histórico de importações">
          <TableWrap label="Importações">
            <thead><tr><th className={th}>Data</th><th className={th}>Tipo</th><th className={th}>Ficheiro</th><th className={`${th} text-right`}>Linhas</th><th className={`${th} text-right`}>Importadas</th><th className={`${th} text-right`}>Ignoradas</th><th className={`${th} text-right`}>Inválidas</th><th className={th}>SHA-256</th></tr></thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td className={td}>{i.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                  <td className={td}>{ENTITY_LABELS[i.entity as keyof typeof ENTITY_LABELS] ?? i.entity}</td>
                  <td className={td}>{i.originalFilename}</td>
                  <td className={`${td} text-right`}>{i.rowsTotal}</td>
                  <td className={`${td} text-right`}>{i.rowsImported}</td>
                  <td className={`${td} text-right`}>{i.rowsSkipped}</td>
                  <td className={`${td} text-right`}>{i.rowsInvalid}</td>
                  <td className={`${td} font-mono text-xs`}>{i.fileHash.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}
    </div>
  );
}
