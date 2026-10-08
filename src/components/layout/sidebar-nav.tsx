"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { Permission } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  permission?: Permission[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/profile", label: "Profile" },
  {
    href: "/dashboard/pdf-management",
    label: "PDF Management",
    permission: ["template:create", "report:generate"],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const hasPermission = useSessionStore((state) => state.hasPermission);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || item.permission.some((permission) => hasPermission(permission))
  );

  return (
    <nav className="flex flex-col gap-1 p-4">
      {visibleItems.map((item) => (
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
