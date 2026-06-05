import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MOODS = [
  { emoji: "😄", label: "Senang", color: "#f4a261", score: 5 },
  { emoji: "😌", label: "Tenang", color: "#4cc9a0", score: 4 },
  { emoji: "😐", label: "Biasa", color: "#888780", score: 3 },
  { emoji: "😔", label: "Sedih", color: "#85b7eb", score: 2 },
  { emoji: "😤", label: "Frustrasi", color: "#e24b4a", score: 1 },
  { emoji: "😴", label: "Lelah", color: "#afa9ec", score: 2 },
];

export async function apiFetch(endpoint: string, options: any = {}) {
  const token = localStorage.getItem("token");
  
  try {
    const response = await axios({
      url: endpoint,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      }
    });
    return response.data;
  } catch (err: any) {
    if (err.response) {
      // Auto-logout jika token invalid/expired
      if (err.response.status === 401) {
        localStorage.clear();
        window.location.reload();
      }
      throw new Error(err.response.data.error || `Error ${err.response.status}: ${err.response.statusText}`);
    } else if (err.request) {
      throw new Error("No response from server. Check your connection.");
    } else {
      throw new Error(err.message);
    }
  }
}
