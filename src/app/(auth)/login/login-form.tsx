"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthAlert, AuthField, AuthSubmit, PasswordInput, authInputClass } from "@/components/ui/auth-fields";
import { signInAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="flex w-full flex-col gap-[18px]">
      {state.error ? <AuthAlert>{state.error}</AuthAlert> : null}
      <AuthField id="email" label="Email" icon="mail">
        <input id="email" name="email" type="email" autoComplete="username" required placeholder="name@company.com" className={authInputClass} />
      </AuthField>
      <PasswordInput id="password" name="password" label="Password" autoComplete="current-password" placeholder="Enter your password" />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="rounded font-medium text-primary-ink hover:underline">
          Forgot password?
        </Link>
      </div>
      <AuthSubmit pending={pending} label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
