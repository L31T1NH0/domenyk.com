import Link from 'next/link';
import Image from 'next/image';

type HeaderProps = {
  home?: boolean;
};

const name = 'Domenyk';

export function Header({ home }: HeaderProps) {
  return (
    <header className="flex flex-col gap-4 items-center">
      {home ? (
        <>
          <Image
            priority
            src="/images/profile.jpg"
            className="rounded-full brightness-125"
            height={148}
            width={148}
            alt={name}
          />
          <h1 className="font-bold text-3xl">{name}</h1>
        </>
      ) : (
        <>
          <Link href="/">
            <a className="hover:brightness-150 brightness-125 transition">
              <Image
                priority
                src="/images/profile.jpg"
                className="rounded-full"
                height={148}
                width={148}
                alt={name}
              />
            </a>
          </Link>
          <h2 className="font-bold text-3xl">
            <Link href="/">
              <a className="text-primary hover:text-link">{name}</a>
            </Link>
          </h2>
        </>
      )}
    </header>
  );
}
