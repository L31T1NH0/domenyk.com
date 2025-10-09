import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react"; // Importe useState e useEffect para gerenciar o carregamento
import Skeleton from "react-loading-skeleton"; // Importe o Skeleton

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

export function Header({ home }: HeaderProps) {
  const [isLoading, setIsLoading] = useState(true); // Estado para controlar o carregamento

  useEffect(() => {
    setIsLoading(false); // Marca o carregamento como concluído após a montagem
  }, []);

  if (isLoading) {
    return (
      <header className="flex flex-col gap-4 items-center">
        <Skeleton
          width={148}
          height={148}
          circle={true}
          className="brightness-125 foto"
        />{" "}
        {/* Skeleton para a imagem circular */}
        <Skeleton width={120} height={32} /> {/* Skeleton para o texto */}
      </header>
    );
  }

  return (
    <header className="flex flex-col gap-4 items-center">
      {home ? (
        <>
          <Image
            priority
            src="/images/profile.jpg"
            className="rounded-full brightness-125 foto"
            height={148}
            width={148}
            alt={name}
          />
          <strong className="text-3xl">{name}</strong>
        </>
      ) : (
        <>
          <Link href="/" legacyBehavior>
            <Image
              priority
              src="/images/profile.jpg"
              className="rounded-full brightness-125 foto"
              height={148}
              width={148}
              alt={name}
            />
          </Link>
          <strong className="text-3xl">Domenyk</strong>
        </>
      )}
    </header>
  );
}
