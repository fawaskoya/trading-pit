"use client";
import { Recover } from "@/components/recover";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Recover error={error} reset={reset} />;
}
