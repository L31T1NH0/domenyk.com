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
            className="rounded-full brightness-125 grayscale"
            height={148}
            width={148}
            alt={name}
          />
          <strong className="text-3xl">{name}</strong>
        </>
      ) : (
        <>
          <Link href="/">
            <a className="hover:brightness-150 brightness-125 transition grayscale">
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
          <strong className="text-3xl">
            <Link href="/">
              <a className="text-primary hover:text-link">{name}</a>
            </Link>
          </strong>
        </>
      )}
    </header>
  );
}
