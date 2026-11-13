"use client";

import { useActionState } from "react";
import { MoreOptions } from "@/components/forms/more-options";
import { Alert } from "@/components/ui/alert";
import { Field, fieldAria } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { formClass, inputClass } from "@/components/ui/styles";
import type { ClientDTO } from "@/modules/clients";
import { createClientAction, updateClientAction, type ClientFormState } from "./actions";

const initial: ClientFormState = {};
const MAIN = [
  { name: "name", label: "Client name", required: true },
  { name: "email", label: "Email", type: "email" },
] as const;
const MORE = [
  { name: "contactPerson", label: "Contact person" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address" },
  { name: "serviceType", label: "Service type", hint: "For example: web design, bookkeeping, support retainer." },
] as const;
type FieldDef = (typeof MAIN)[number] | (typeof MORE)[number];

export function ClientForm({ client }: { client?: ClientDTO }) {
  const [state, action, pending] = useActionState(client ? updateClientAction : createClientAction, initial);
  const prefix = client ? "edit-" : "";
  const renderField = (f: FieldDef) => {
    const id = `${prefix}${f.name}`;
    const error = state.fieldErrors?.[f.name]?.[0];
    const hint = "hint" in f ? f.hint : undefined;
    return (
      <Field key={f.name} id={id} label={f.label} required={"required" in f} error={error} hint={hint}>
        <input
          id={id}
          name={f.name}
          type={"type" in f ? f.type : "text"}
          required={"required" in f}
          defaultValue={client ? (client[f.name] ?? "") : ""}
          className={inputClass}
          {...fieldAria(id, { error, hint })}
        />
      </Field>
    );
  };
  return (
    <form action={action} className={formClass}>
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.saved ? <Alert tone="success">Saved.</Alert> : null}
      {MAIN.map(renderField)}
      <MoreOptions defaultOpen={MORE.some((f) => Boolean(client?.[f.name]))}>{MORE.map(renderField)}</MoreOptions>
      <FormActions label={client ? "Save changes" : "Create client"} pending={pending} cancelHref={client ? undefined : "/clients"} />
    </form>
  );
}
