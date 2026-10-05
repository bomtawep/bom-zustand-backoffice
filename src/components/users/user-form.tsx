"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserSchema, ROLES, type CreateUserInput } from "@/lib/schemas";

interface UserFormProps {
  defaultValues?: Partial<CreateUserInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CreateUserInput) => void | Promise<void>;
}

export function UserForm({
  defaultValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: UserFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      role: defaultValues?.role ?? "viewer",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.role}>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.role]} />
        </Field>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
