const MINOR_UNITS_PER_MAJOR = 100n;
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function assertSafeMinor(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Money must be an integer number of minor units.");
  }
  return BigInt(value);
}

function toSafeNumber(value: bigint): number {
  if (value > MAX_SAFE_MINOR || value < -MAX_SAFE_MINOR) {
    throw new RangeError("Money exceeds the supported integer range.");
  }
  return Number(value);
}

/** Convert a non-negative decimal amount to minor units, rounding half-up to 2 dp. */
export function toMinor(amount: string): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) {
    throw new TypeError("Amount must be a non-negative decimal string.");
  }

  const whole = BigInt(match[1]);
  const fraction = match[2] ?? "";
  const firstTwo = (fraction + "00").slice(0, 2);
  let minor = whole * MINOR_UNITS_PER_MAJOR + BigInt(firstTwo);
  if (fraction.length > 2 && fraction[2] >= "5") minor += 1n;
  return toSafeNumber(minor);
}

/** Format integer minor units as a decimal string without floating-point math. */
export function fromMinor(minor: number): string {
  const value = assertSafeMinor(minor);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MINOR_UNITS_PER_MAJOR;
  const fraction = (absolute % MINOR_UNITS_PER_MAJOR).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function add(left: number, right: number): number {
  return toSafeNumber(assertSafeMinor(left) + assertSafeMinor(right));
}

export function sub(left: number, right: number): number {
  return toSafeNumber(assertSafeMinor(left) - assertSafeMinor(right));
}

/** Multiply a decimal quantity by a per-unit minor-unit rate, rounding half-up. */
export function mul(quantity: string, unitRateMinor: number): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(quantity);
  if (!match) throw new TypeError("Quantity must be a non-negative decimal string.");

  const fraction = match[2] ?? "";
  const scale = 10n ** BigInt(fraction.length);
  const quantityScaled = BigInt(match[1]) * scale + BigInt(fraction || "0");
  const rate = assertSafeMinor(unitRateMinor);
  if (rate < 0n) throw new RangeError("Unit rate must not be negative.");
  const product = quantityScaled * rate;
  const rounded = (product + scale / 2n) / scale;
  return toSafeNumber(rounded);
}

/** Round a decimal string to two places using the shared half-up rule. */
export function roundHalfUp(amount: string): string {
  return fromMinor(toMinor(amount));
}
