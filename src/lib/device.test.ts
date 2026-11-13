import { describe, expect, it } from "vitest";
import { describeDevice, describeIp } from "./device";

describe("describeDevice", () => {
  const cases: [string, string][] = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.8127.18 Safari/537.36", "Chrome on Windows"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0", "Edge on Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Safari on macOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Safari on iOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1", "Chrome on iOS"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36", "Chrome on Android"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox on Linux"],
  ];
  it.each(cases)("%s", (ua, expected) => expect(describeDevice(ua)).toBe(expected));

  it("falls back gracefully", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(describeDevice("")).toBe("Unknown device");
    expect(describeDevice("curl/8.0")).toBe("Unknown device");
  });
});

describe("describeIp", () => {
  it("handles missing, all-zero and local addresses", () => {
    expect(describeIp(null)).toBe("unknown location");
    expect(describeIp("0000:0000:0000:0000:0000:0000:0000:0000")).toBe("unknown location");
    expect(describeIp("::")).toBe("unknown location");
    expect(describeIp("::1")).toBe("this computer");
    expect(describeIp("127.0.0.1")).toBe("this computer");
    expect(describeIp("::ffff:127.0.0.1")).toBe("this computer");
  });

  it("keeps IPv4 and shortens IPv6", () => {
    expect(describeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(describeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(describeIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(describeIp("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2:3:4:5:6");
  });
});
