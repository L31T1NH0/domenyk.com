import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react"; // Importe useState e useEffect para gerenciar o carregamento
import Skeleton from "react-loading-skeleton"; // Importe o Skeleton

type PostHeaderProps = {
  cape?: string; // Link opcional para a imagem principal (capa)
  title: string; // Título do post
};

export function PostHeader({ cape, title }: PostHeaderProps) {
  console.log("Cape value in PostHeader:", cape); // Debug para verificar o valor de cape
  const [isLoading, setIsLoading] = useState(true); // Estado para controlar o carregamento

  useEffect(() => {
    setIsLoading(false); // Marca o carregamento como concluído após a montagem
  }, []);

  if (isLoading) {
    return (
      <div className="w-full relative">
        {cape && (
          <div className="w-full">
            <Skeleton height={200} width="100%" /> {/* Skeleton para a capa */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4">
              <Skeleton circle={true} height={56} width={56} /> {/* Skeleton para a foto */}
              <Skeleton width={200} height={32} /> {/* Skeleton para o título */}
            </div>
          </div>
        )}
        {!cape && (
          <div className="flex flex-col gap-4 items-center">
            <Skeleton circle={true} height={148} width={148} /> {/* Skeleton para a foto */}
            <Skeleton width={120} height={32} /> {/* Skeleton para o texto */}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full relative">
      {cape && (
        <div className="w-full relative">
          <img src={cape} alt="Banner Principal" className="banner w-full h-auto" />
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-[#040404] via-[#040404]/70 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-[45%] bg-gradient-to-t from-[#040404] via-[#040404]/70 to-transparent"></div>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-4">
            <div>
              <Link href="/" legacyBehavior>
                <Image
                  priority
                  src="/images/profile.jpg"
                  className="foto-post"
                  height={56}
                  width={56}
                  alt="Domenyk"
                />
              </Link>
            </div>
            <h1 className="text-xl text-white flex-1">{title}</h1>
          </div>
        </div>
      )}
      {!cape && (
        <div className="flex flex-col gap-4 items-center">
          <Link href="/" legacyBehavior>
            <Image
              priority
              src="/images/profile.jpg"
              className="rounded-full brightness-125 foto"
              height={148}
              width={148}
              alt="Domenyk"
            />
          </Link>
          <strong className="text-3xl">{title}</strong>
        </div>
      )}
    </div>
  );
}
