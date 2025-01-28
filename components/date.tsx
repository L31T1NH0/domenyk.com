import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JSX } from 'react/jsx-runtime';

type DateProps = {
  dateString: string;
};

export function Date({ dateString }: DateProps): JSX.Element {
  const date = parseISO(dateString);
  const formattedDate = format(date, 'eee, dd MMMM yyyy', { locale: ptBR });

  return (
    <time className='text-secondary text-lg' dateTime={dateString}>
      {formattedDate}
    </time>
  );
}
