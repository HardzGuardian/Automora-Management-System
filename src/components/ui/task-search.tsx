"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";
import { inputClass } from "./styles";

type Item = { id: string; taskCode: string; title: string; status: string; dueDate: string | null };

/** Wraps the part of `text` that matches `q` so people see why a task was suggested. */
function Marked({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary-soft px-0.5 text-primary-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * The Tasks search box. While you type, a dropdown lists the matching tasks (title or code) so you can
 * pick one straight away; Enter with nothing highlighted still filters the list like before.
 * It stays a normal `<input name>` inside the filter form, so the form works without JavaScript.
 */
export function TaskSearch({
  name = "q",
  defaultValue = "",
  view,
  placeholder = "Title or code",
}: {
  name?: string;
  defaultValue?: string;
  /** "mine" searches only the person's own tasks, "all" every task they may see. */
  view: "mine" | "all";
  placeholder?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    // Close when clicking anywhere outside the box.
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const search = (text: string) => {
    clearTimeout(timer.current);
    abort.current?.abort();
    const q = text.trim();
    if (!q) {
      setItems([]);
      setTotal(0);
      setSearched("");
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const res = await fetch(`/api/tasks/suggest?q=${encodeURIComponent(q)}&view=${view}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items: Item[]; total: number };
        setItems(data.items);
        setTotal(data.total);
        setSearched(q);
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setItems([]);
          setTotal(0);
          setSearched(q);
          setOpen(false);
        }
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 150);
  };

  const go = (item: Item) => {
    setOpen(false);
    router.push(`/tasks/${item.id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && items.length > 0) setOpen(true);
      setActive((a) => (items.length === 0 ? -1 : (a + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length === 0 ? -1 : a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault(); // open the highlighted task instead of submitting the filter form
      go(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const status = !value.trim()
    ? ""
    : loading
      ? "Searching"
      : searched === value.trim()
        ? items.length === 0
          ? "No matching tasks"
          : `${total} matching ${total === 1 ? "task" : "tasks"}`
        : "";

  return (
    <div ref={box} className="relative">
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className={inputClass}
        onChange={(e) => {
          setValue(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => {
          if (items.length > 0 || searched) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--elev-3)]">
          {items.length === 0 ? (
            <p className="m-0 px-3 py-3 text-sm text-muted">No tasks match “{searched}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Matching tasks" className="m-0 max-h-80 list-none overflow-y-auto p-1">
              {items.map((t, i) => (
                <li
                  key={t.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the input so the click is not lost
                  onClick={() => go(t)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-primary-soft" : "hover:bg-background")}
                >
                  <Icon name="tasks" size={16} className="flex-none text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      <Marked text={t.title} q={searched} />
                    </span>
                    <span className="block truncate text-xs text-muted">
                      <Marked text={t.taskCode} q={searched} /> · {t.status}
                      {t.dueDate ? ` · due ${t.dueDate}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && total > items.length ? (
            <p className="m-0 border-t border-border px-3 py-2 text-xs text-muted">
              Showing {items.length} of {total}. Press Enter to filter the whole list.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
