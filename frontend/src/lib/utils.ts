import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function riskColor(score: number): string {
  if (score > 70) return "text-[#ef4444]";
  if (score > 45) return "text-[#f59e0b]";
  return "text-[#374151]";
}

export function riskBg(score: number): string {
  if (score > 70) return "bg-[#ef4444]/10 text-[#ef4444]";
  if (score > 45) return "bg-[#f59e0b]/10 text-[#f59e0b]";
  return "bg-[#F3F4F6] text-[#6B7280]";
}

export function riskBorder(score: number): string {
  if (score > 70) return "border-l-[#ef4444]";
  if (score > 45) return "border-l-[#f59e0b]";
  return "border-l-[#D1D5DB]";
}
