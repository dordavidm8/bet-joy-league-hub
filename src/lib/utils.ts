// utils.ts – פונקציות עזר כלליות
// cn(...classes) – מיזוג class names עם clsx + tailwind-merge.
// פונקציות עזר לפורמט תאריכים, מספרים, ועוד.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
