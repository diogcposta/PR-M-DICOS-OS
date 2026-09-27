import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SubNav } from "@/components/production/SubNav";

export const metadata: Metadata = {
  title: { default: "Clinical Production Dashboard", template: "%s · Produção clínica" },
};

export default function ProductionLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="space-y-8">
      <SubNav />
      {children}
    </div>
  );
}
