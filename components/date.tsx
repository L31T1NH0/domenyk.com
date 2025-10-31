import React from "react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { JSX } from "react/jsx-runtime";

type DateProps = {
  dateString: string;
  className?: string;
};

export function Date({ dateString, className }: DateProps): JSX.Element {
  if (!dateString) {
    return <span>Data inválida</span>;
  }

  const date = parseISO(dateString);
  const formattedDate = format(date, "eee, dd MMMM yyyy", { locale: ptBR });

  return (
    <time
      className={className ?? "text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-muted)]"}
      dateTime={dateString}
    >
      {formattedDate}
    </time>
  );
}