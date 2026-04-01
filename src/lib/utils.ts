import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function hoursSince(timestamp?: number) {
  if (!timestamp) {
    return 0;
  }

  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
}

export function safeRatio(numerator: number, denominator: number) {
  return numerator / Math.max(denominator, 1);
}

export function toBooleanFlag(value: unknown) {
  return value === "1" || value === 1 || value === true;
}
