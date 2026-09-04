import { ImportWizard } from "@/components/imports/ImportWizard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewImportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Importar agenda"
        description="Carregue uma exportação de agenda, confirme o mapeamento das colunas e reveja os erros antes de gravar. Nada é gravado até confirmar."
      />
      <ImportWizard />
    </div>
  );
}
