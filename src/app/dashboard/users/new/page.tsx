"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserForm } from "@/components/users/user-form";
import type { CreateUserInput } from "@/lib/schemas";
import { useCreateUserMutation } from "@/queries/users";
import { useSessionStore } from "@/stores/session-store";

export default function NewUserPage() {
  const router = useRouter();
  const createUserMutation = useCreateUserMutation();
  const canCreate = useSessionStore((state) => state.hasPermission("user:create"));

  async function handleSubmit(values: CreateUserInput) {
    try {
      await createUserMutation.mutateAsync(values);
      toast.success("User created");
      router.push("/dashboard/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create user");
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have permission to create users.</p>;
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">New user</h1>
      <UserForm
        submitLabel="Create user"
        isSubmitting={createUserMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
