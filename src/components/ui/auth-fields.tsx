"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

const FIELD =
  "flex h-12 items-center gap-2.5 rounded-[10px] border border-field bg-surface pl-3.5 pr-1.5 text-muted transition-colors hover:border-[#8e9a93] focus-within:border-primary focus-within:text-primary focus-within:shadow-[0_0_0_4px_rgba(22,124,80,0.16)]";
const INPUT = "h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[#8a958f]";

/** Label above a 48px field with a leading icon (sign-in family). */
export function AuthField({
  id,
  label,
  icon,
  error,
  hint,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon: IconName;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className={cn(FIELD, error && "border-danger")}>
        <Icon name={icon} size={18} className="flex-none" />
        {children}
        {trailing}
      </div>
      {hint && !error ? <p id={`${id}-hint`} className="m-0 text-xs text-muted">{hint}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="m-0 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export const authInputClass = INPUT;

export function AuthAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 font-medium", tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}
    >
      <Icon name={tone === "error" ? "warning" : "completed"} size={18} className="flex-none" />
      <span>{children}</span>
    </div>
  );
}

/** Full-width 48px primary button (sign-in family). */
export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover active:bg-[#0a4f31] disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
      {pending ? null : <Icon name="arrowRight" size={18} strokeWidth={2.2} />}
    </button>
  );
}

function ShowToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={shown} className="h-9 rounded-lg px-2.5 text-[13px] font-semibold text-primary-ink hover:bg-primary-soft">
      {shown ? "Hide" : "Show"}
    </button>
  );
}

/** Password field with a Show/Hide button. Posts as `name`. */
export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  minLength,
  hint,
  error,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [shown, setShown] = useState(false);
  const controlled = value !== undefined;
  return (
    <AuthField id={id} label={label} icon="lock" hint={hint} error={error} trailing={<ShowToggle shown={shown} onToggle={() => setShown((s) => !s)} />}>
      <input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={INPUT}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        {...(controlled ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) } : {})}
      />
    </AuthField>
  );
}

/** "Choose a password" pair with live rule chips: length and both fields matching. */
export function NewPasswordFields({ minLength = 10, errors }: { minLength?: number; errors?: { password?: string; confirm?: string } }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const okLen = p1.length >= minLength;
  const okMatch = p1.length > 0 && p1 === p2;
  const chip = (ok: boolean, text: string) => (
    <li className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium", ok ? "bg-[#e6f4ec] text-primary-ink" : "bg-[#f1f3f1] text-muted")}>
      <Icon name={ok ? "check" : "inactive"} size={14} strokeWidth={2.6} />
      {text}
      <span className="sr-only">{ok ? " (met)" : " (not met yet)"}</span>
    </li>
  );
  return (
    <>
      <PasswordInput id="password" name="password" label="Password" autoComplete="new-password" placeholder={`At least ${minLength} characters`} minLength={minLength} value={p1} onChange={setP1} error={errors?.password} />
      <PasswordInput id="confirm" name="confirm" label="Confirm password" autoComplete="new-password" placeholder="Type it again" value={p2} onChange={setP2} error={errors?.confirm} />
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {chip(okLen, `At least ${minLength} characters`)}
        {chip(okMatch, "Both passwords match")}
      </ul>
    </>
  );
}
