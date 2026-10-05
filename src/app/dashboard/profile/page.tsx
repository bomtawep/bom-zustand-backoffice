"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas";
import { useChangePasswordMutation, useLogoutAllMutation, useMeQuery } from "@/queries/auth";

export default function ProfilePage() {
  const router = useRouter();
  const meQuery = useMeQuery();
  const changePasswordMutation = useChangePasswordMutation();
  const logoutAllMutation = useLogoutAllMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    try {
      await changePasswordMutation.mutateAsync(values);
      toast.success("Password updated");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password");
    }
  }

  async function handleSignOutEverywhere() {
    await logoutAllMutation.mutateAsync();
    router.push("/login");
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Name: {meQuery.data?.name}</p>
          <p>Email: {meQuery.data?.email}</p>
          <p>Role: {meQuery.data?.role}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.oldPassword}>
                <FieldLabel htmlFor="oldPassword">Current password</FieldLabel>
                <Input
                  id="oldPassword"
                  type="password"
                  autoComplete="current-password"
                  {...register("oldPassword")}
                />
                <FieldError errors={[errors.oldPassword]} />
              </Field>
              <Field data-invalid={!!errors.newPassword}>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                <FieldError errors={[errors.newPassword]} />
              </Field>
              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                Update password
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={handleSignOutEverywhere}>
        Sign out everywhere
      </Button>
    </div>
  );
}
