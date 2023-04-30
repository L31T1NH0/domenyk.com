import Link from 'next/link';

export function BackHome() {
  return (
    <Link href='/'>
      <a className='text-lg'>← Voltar para Home</a>
    </Link>
  );
}
