import Image from "next/image";
import BlogIconSVG from "../public/images/CarbonBlog.svg";

export function BlogIcon() {
  return (
    <div>
      <Image
        src={BlogIconSVG}
        alt="Blog Icon"
        width={32}
        height={32}
        priority
      />
    </div>
  );
}
