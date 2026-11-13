import { describe, expect, it } from "vitest";
import { isLeavingPage, type LinkClick } from "./unsaved-changes";

const base: LinkClick = {
  href: "https://app.test/clients",
  currentUrl: "https://app.test/clients/new",
  button: 0,
  modifier: false,
  defaultPrevented: false,
};

describe("isLeavingPage", () => {
  it("is true for an ordinary internal link", () => {
    expect(isLeavingPage(base)).toBe(true);
  });

  it("is true for an external http link opened in the same tab", () => {
    expect(isLeavingPage({ ...base, href: "https://other.test/x" })).toBe(true);
  });

  it("is false for a hash jump on the same page", () => {
    expect(isLeavingPage({ ...base, href: "https://app.test/clients/new#notes" })).toBe(false);
  });

  it("is true when only the query string differs", () => {
    expect(isLeavingPage({ ...base, href: "https://app.test/clients/new?x=1" })).toBe(true);
  });

  it("is false for new-tab, download, modifier, non-primary and already-handled clicks", () => {
    expect(isLeavingPage({ ...base, target: "_blank" })).toBe(false);
    expect(isLeavingPage({ ...base, download: true })).toBe(false);
    expect(isLeavingPage({ ...base, modifier: true })).toBe(false);
    expect(isLeavingPage({ ...base, button: 1 })).toBe(false);
    expect(isLeavingPage({ ...base, defaultPrevented: true })).toBe(false);
  });

  it("treats target=_self as leaving", () => {
    expect(isLeavingPage({ ...base, target: "_self" })).toBe(true);
  });

  it("is false for mailto/tel and for unparseable URLs", () => {
    expect(isLeavingPage({ ...base, href: "mailto:a@b.test" })).toBe(false);
    expect(isLeavingPage({ ...base, href: "not a url" })).toBe(false);
  });
});
