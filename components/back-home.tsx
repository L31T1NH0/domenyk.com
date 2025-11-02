import Link from "next/link";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/outline";

export function BackHome() {
  return (
    <div>
      <Link href="/" className="flex w-fit h-fit" aria-label="Voltar para a página inicial" title="Voltar para a página inicial">
        <ArrowLeftCircleIcon className="size-5" aria-hidden="true" />
      </Link>
    </div>
  );
}
