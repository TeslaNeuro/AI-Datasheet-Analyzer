import { useCallback, useRef, useState } from "react";
import { IconUpload, IconFile, IconX } from "./Icons";

interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}

export function Dropzone({ file, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = useCallback(
    (f: FileList | null) => {
      if (!f || f.length === 0) return;
      const pick = Array.from(f).find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
      if (pick) onFile(pick);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        "card relative cursor-pointer select-none p-6 transition-all",
        over ? "border-accent-500/60 bg-ink-900" : "hover:border-ink-700 hover:bg-ink-900",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      aria-label="Upload a datasheet PDF"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />

      {!file ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 rounded-full bg-accent-600/10 p-3 text-accent-400">
            <IconUpload width={22} height={22} />
          </div>
          <div className="text-base font-medium text-ink-50">Drop a datasheet PDF here</div>
          <div className="mt-1 text-sm text-ink-400">or click to browse — processed locally in your browser</div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-md bg-accent-600/10 p-2 text-accent-400">
              <IconFile width={18} height={18} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-ink-50">{file.name}</div>
              <div className="text-xs text-ink-400">{formatBytes(file.size)}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
            aria-label="Remove file"
          >
            <IconX />
          </button>
        </div>
      )}
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
