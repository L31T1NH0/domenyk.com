import React from "react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { JSX } from "react/jsx-runtime";

type DateProps = {
  dateString: string;
};

export function Date({ dateString }: DateProps): JSX.Element {
  if (!dateString) {
    return <span>Data inválida</span>;
  }

  const date = parseISO(dateString);
  const formattedDate = format(date, "eee, dd MMMM yyyy", { locale: ptBR });

  return (
    <time
      className="text-[11px] uppercase tracking-[0.35em] text-neutral-500"
      dateTime={dateString}
    >
      {formattedDate}
    </time>
  );
}