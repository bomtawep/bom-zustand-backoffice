"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLogoutMutation, useMeQuery } from "@/queries/auth";

export function Topbar() {
  const router = useRouter();
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();

  async function handleSignOut() {
    try {
      await logoutMutation.mutateAsync();
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    }
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <span className="text-sm text-muted-foreground">
        {meQuery.data ? `Signed in as ${meQuery.data.name}` : ""}
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </header>
  );
}
