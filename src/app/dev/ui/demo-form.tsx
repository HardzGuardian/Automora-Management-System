"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DateField, MoneyField, PickerField, SubmitRow, TextField, useUnsavedChangesWarning } from "@/components/forms/form-kit";
import { parseMoneyInput } from "@/components/forms/money";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title"),
  amount: z.string().refine((v) => parseMoneyInput(v) !== null, "Enter an amount like 1234.50"),
  due: z.string().min(1, "Choose a date"),
  owner: z.string().min(1, "Choose someone"),
});
type Values = z.infer<typeof schema>;

export function DemoForm() {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", amount: "", due: "", owner: "" } });
  useUnsavedChangesWarning(isDirty);

  return (
    <form
      onSubmit={handleSubmit(async () => {
        await new Promise((r) => setTimeout(r, 300));
        setSaved(true);
        toast("Demo form saved (nothing was stored)");
      })}
      className="grid max-w-md gap-3"
      noValidate
    >
      <TextField<Values> name="title" label="Title" required register={register} error={errors.title?.message} />
      <MoneyField<Values> name="amount" label="Amount" currency="INR" required control={control} error={errors.amount?.message} />
      <DateField<Values> name="due" label="Due date" required register={register} error={errors.due?.message} />
      <PickerField<Values> name="owner" label="Owner" required register={register} error={errors.owner?.message} options={[{ id: "1", label: "Asha Admin" }, { id: "2", label: "Ravi Employee" }]} />
      <SubmitRow pending={isSubmitting} label="Save">
        {saved ? <span role="status" className="text-sm text-success">Saved</span> : null}
      </SubmitRow>
    </form>
  );
}
