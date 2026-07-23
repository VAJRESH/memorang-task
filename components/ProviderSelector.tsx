"use client";

import { cn } from "@/lib/utils";
import type { AIProvider } from "@/lib/hooks/useLearningAgent";

const PROVIDERS: { id: AIProvider; label: string; description: string }[] = [
  {
    id: "groq",
    label: "Groq",
    description: "Llama 3.3 70B (fast, generous limits)",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "Google's Gemini 2.0 Flash",
  },
];

export interface ProviderSelectorProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
}

/**
 * Toggle switch to select between Gemini and Groq as the AI provider.
 * Shown on the idle screen before uploading a PDF.
 */
export function ProviderSelector({
  value,
  onChange,
  disabled,
}: ProviderSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.id)}
          className={cn(
            "flex flex-col items-start rounded-md px-4 py-2 text-left transition-colors",
            value === p.id
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-50",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="text-sm font-medium">{p.label}</span>
          <span
            className={cn(
              "text-xs",
              value === p.id ? "text-indigo-100" : "text-gray-400",
            )}
          >
            {p.description}
          </span>
        </button>
      ))}
    </div>
  );
}
