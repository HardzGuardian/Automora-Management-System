"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { signInAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field id="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm">
        <Link href="/forgot-password" className={linkClass}>
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
