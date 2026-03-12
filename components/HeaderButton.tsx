"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HeaderButton = ({
  pathnameUrl,
  name,
}: {
  pathnameUrl: string;
  name: string;
}) => {
  const pathname = usePathname();

  return (
    <Link
      href={pathnameUrl || "/coins"}
      className={cn("nav-link", {
        "is-active": pathname === pathnameUrl || pathname === "/coins",
        "is-home": true,
      })}
    >
      {name}
    </Link>
  );
};

export default HeaderButton;
