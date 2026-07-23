"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PDF_TYPE = "application/pdf";
const MAX_SIZE = 10 * 1024 * 1024;

export interface PdfUploaderProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

/** Drag-and-drop + click PDF upload surface with client-side validation. */
export function PdfUploader({ onUpload, disabled }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateAndUpload = useCallback(
    (file: File | undefined) => {
      setLocalError(null);
      if (!file) return;
      if (file.type !== PDF_TYPE) {
        setLocalError("Please choose a PDF file.");
        return;
      }
      if (file.size === 0) {
        setLocalError("That file is empty.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setLocalError("File exceeds the 10 MB limit.");
        return;
      }
      onUpload(file);
    },
    [onUpload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      validateAndUpload(e.dataTransfer.files?.[0]);
    },
    [disabled, validateAndUpload],
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-300 bg-gray-50",
          disabled && "opacity-60",
        )}
      >
        <svg
          className="h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            Drag and drop a PDF here
          </p>
          <p className="text-xs text-gray-500">or</p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose PDF
        </Button>
        <p className="text-xs text-gray-400">Max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => validateAndUpload(e.target.files?.[0])}
        />
      </div>
      {localError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {localError}
        </p>
      )}
    </div>
  );
}
