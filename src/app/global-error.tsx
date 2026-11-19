"use client";
import { Recover } from "@/components/recover";

/** Last resort, when even the root layout fails. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#141a2b", color: "#f4efe6" }}>
        <Recover error={error} reset={reset} />
      </body>
    </html>
  );
}
