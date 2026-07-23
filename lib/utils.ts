import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge a variadic list of class name values into a single string,
 * resolving conflicting Tailwind utilities to the last-specified value.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
