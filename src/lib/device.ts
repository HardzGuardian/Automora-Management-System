/** Human wording for a session's browser string and IP address (pure, so it is easy to test). */

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  // Order matters: Android reports "Linux", and iPhone reports "like Mac OS X".
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Macintosh|Mac OS X/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

export function describeIp(ip: string | null): string {
  if (!ip) return "unknown location";
  const v = ip.trim().toLowerCase();
  if (v === "" || /^[0:]+$/.test(v)) return "unknown location";
  if (v === "::1" || v === "127.0.0.1" || v === "::ffff:127.0.0.1") return "this computer";
  const mapped = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!v.includes(":")) return v; // IPv4
  // IPv6: drop leading zeros in each group, then collapse the longest run of zero groups.
  const groups = v.split(":").map((g) => g.replace(/^0+(?=.)/, ""));
  let best = { start: -1, len: 0 };
  for (let i = 0; i < groups.length; ) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === "0") j++;
    if (j - i > best.len) best = { start: i, len: j - i };
    i = j;
  }
  if (best.len < 2) return groups.join(":");
  const head = groups.slice(0, best.start).join(":");
  const tail = groups.slice(best.start + best.len).join(":");
  return `${head}::${tail}`;
}
