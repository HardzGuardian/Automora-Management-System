"use client";

import { useEffect } from "react";
import { useToast } from "./toast";

/** Shows the server-queued flash message once, then clears its cookie. */
export function FlashToast({ message, tone, nonce }: { message: string; tone: "success" | "error"; nonce: string }) {
  const toast = useToast();
  useEffect(() => {
    toast(message, tone);
    document.cookie = "automora_flash=; Max-Age=0; path=/";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  return null;
}
