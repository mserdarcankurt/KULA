/**
 * FILE: utils.ts
 * ROLE IN KULA: A tiny but essential utility for merging Tailwind CSS classes.
 * 
 * WHY THIS EXISTS:
 * In Tailwind, conflicting classes like "text-red-500" and "text-blue-500" can coexist
 * on the same element, causing unpredictable styling. `cn()` intelligently merges them,
 * ensuring the LAST class wins.
 * 
 * HOW IT WORKS:
 *   1. `clsx()` handles conditional class toggling: cn("base", isActive && "active")
 *   2. `twMerge()` resolves Tailwind conflicts: cn("px-4 px-8") → "px-8"
 * 
 * USED BY: Any component that needs to conditionally apply Tailwind classes.
 * Example in PostItem.tsx: cn("rounded-2xl", isSelected && "ring-2 ring-emerald-500")
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
