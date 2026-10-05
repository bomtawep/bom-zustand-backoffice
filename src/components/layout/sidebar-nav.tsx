"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/profile", label: "Profile" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
            pathname === item.href && "bg-accent text-accent-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
