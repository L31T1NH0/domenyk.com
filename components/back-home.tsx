import Link from "next/link";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/outline";

export function BackHome() {
  return (
    <div>
      <Link href="/" className="flex w-fit h-fit">
        <ArrowLeftCircleIcon className="size-5" />
      </Link>
    </div>
  );
}
