import Link from 'next/link';

export function BackHome() {
  return (
    (<Link href="/" className="text-lg lg:text-lg max-sm:text-sm">
      ← Voltar para Home
    </Link>)
  );
}
