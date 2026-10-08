"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTemplateSchema, type CreateTemplateInput } from "@/lib/schemas";
import { useCreateTemplateMutation } from "@/queries/templates";

export function TemplateForm() {
  const createTemplateMutation = useCreateTemplateMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: { name: "", description: "", htmlContent: "" },
  });

  async function onSubmit(values: CreateTemplateInput) {
    try {
      await createTemplateMutation.mutateAsync(values);
      toast.success("Template created");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create template");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="template-name">Name</FieldLabel>
          <Input id="template-name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="template-description">Description</FieldLabel>
          <Input id="template-description" {...register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <Field data-invalid={!!errors.htmlContent}>
          <FieldLabel htmlFor="template-html">HTML content</FieldLabel>
          <Textarea id="template-html" rows={10} {...register("htmlContent")} />
          <FieldError errors={[errors.htmlContent]} />
        </Field>
        <Button type="submit" disabled={createTemplateMutation.isPending}>
          Create template
        </Button>
      </FieldGroup>
    </form>
  );
}
