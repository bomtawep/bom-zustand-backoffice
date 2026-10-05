"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserForm } from "@/components/users/user-form";
import type { CreateUserInput } from "@/lib/schemas";
import { useCreateUserMutation } from "@/queries/users";

export default function NewUserPage() {
  const router = useRouter();
  const createUserMutation = useCreateUserMutation();

  async function handleSubmit(values: CreateUserInput) {
    try {
      await createUserMutation.mutateAsync(values);
      toast.success("User created");
      router.push("/dashboard/users");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create user");
    }
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
