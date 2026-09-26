"use client";

import { btnSecondary } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnSecondary}>
      ⎙ Imprimir / Guardar PDF
    </button>
  );
}
