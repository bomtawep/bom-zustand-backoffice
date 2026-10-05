"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserForm } from "@/components/users/user-form";
import type { CreateUserInput } from "@/lib/schemas";
import { useUpdateUserMutation, useUserQuery } from "@/queries/users";
import { useSessionStore } from "@/stores/session-store";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const userQuery = useUserQuery(id);
  const updateUserMutation = useUpdateUserMutation(id);
  const canUpdate = useSessionStore((state) => state.hasPermission("user:update"));

  async function handleSubmit(values: CreateUserInput) {
    try {
      await updateUserMutation.mutateAsync(values);
      toast.success("User updated");
      router.push("/dashboard/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user");
    }
  }

  if (!canUpdate) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit users.</p>;
  }

  if (userQuery.isLoading) {
    return <Skeleton className="h-64 w-full max-w-md" />;
  }

  if (userQuery.isError) {
    return <p className="text-sm text-muted-foreground">Could not load this user.</p>;
  }

  if (!userQuery.data) {
    return <p className="text-sm text-muted-foreground">User not found.</p>;
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <UserForm
        defaultValues={userQuery.data}
        submitLabel="Save changes"
        isSubmitting={updateUserMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
