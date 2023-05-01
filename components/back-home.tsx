import Link from 'next/link';

export function BackHome() {
  return (
    <Link href="/">
      <a className="text-lg lg:text-lg sm:text-sm">← Voltar para Home</a>
    </Link>
  );
}
