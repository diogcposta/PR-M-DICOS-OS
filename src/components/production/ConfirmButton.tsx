"use client";

import type { ReactNode } from "react";

/** Botão de submissão que pede confirmação (apagar registos). */
export function ConfirmButton({
  children,
  message,
  className,
}: {
  readonly children: ReactNode;
  readonly message: string;
  readonly className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
