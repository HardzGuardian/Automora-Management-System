/** Decides whether a click on a link would take the user away from the page they are editing. */
export type LinkClick = {
  /** The link's resolved absolute URL. */
  href: string;
  /** The page the user is on now. */
  currentUrl: string;
  /** Anchor target attribute, e.g. "_blank". */
  target?: string | null;
  download?: boolean;
  /** Mouse button (0 = primary). */
  button: number;
  /** Any of ctrl/meta/shift/alt held (open in new tab/window, download). */
  modifier: boolean;
  defaultPrevented: boolean;
};

export function isLeavingPage(click: LinkClick): boolean {
  if (click.defaultPrevented || click.button !== 0 || click.modifier || click.download) return false;
  if (click.target && click.target !== "_self") return false;
  let to: URL;
  let from: URL;
  try {
    to = new URL(click.href);
    from = new URL(click.currentUrl);
  } catch {
    return false;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  // Jumping to an anchor on the same page is not leaving it.
  if (to.origin === from.origin && to.pathname === from.pathname && to.search === from.search) return false;
  return true;
}

export const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Leave this page and lose them?";
