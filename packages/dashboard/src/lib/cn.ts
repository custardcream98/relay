// packages/dashboard/src/lib/cn.ts
// Utility for composing Tailwind class names safely.
// Uses clsx for conditional logic and tailwind-merge to resolve conflicting classes.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
