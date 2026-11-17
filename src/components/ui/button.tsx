import type { ButtonHTMLAttributes } from "react";
import { buttonClass } from "./styles";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };

export function Button({ variant = "primary", className, type = "button", ...rest }: Props) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}
