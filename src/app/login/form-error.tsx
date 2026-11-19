import { CircleAlert } from "lucide-react";

/** Inline form error: stays on screen (a toast vanishes before a nervous first-timer reads it). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
