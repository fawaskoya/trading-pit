"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { joinTeam } from "@/lib/auth";

type State = { status: "joining" } | { status: "failed"; error: string; code?: string };

/** Claims the team as soon as the page opens, so scanning the QR code is the whole login. */
export function AutoJoin({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "joining" });
  const started = useRef(false);

  const join = useCallback(async () => {
    setState({ status: "joining" });
    const res = await joinTeam(code);
    if (!res.ok) { setState({ status: "failed", error: res.error, code: res.code }); return; }
    router.replace("/play");
    router.refresh();
  }, [code, router]);

  useEffect(() => {
    if (started.current) return; // React strict mode mounts twice in dev; join once.
    started.current = true;
    void join();
  }, [join]);

  if (state.status === "joining") {
    return (
      <Card className="items-center p-8 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <h1 className="mt-4 text-2xl font-extrabold">Joining your team…</h1>
        <p className="mt-1 font-mono text-lg tracking-[0.3em] text-muted-foreground">{code}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CircleAlert className="size-8 text-destructive" />
      <h1 className="mt-3 text-2xl font-extrabold">Couldn&apos;t join team {code}</h1>
      <p role="alert" className="mt-2 text-muted-foreground">{state.error}</p>
      <div className="mt-5 grid gap-2">
        {state.code === "USER_HAS_TEAM" ? (
          <Button size="lg" nativeButton={false} render={<Link href="/play" />}>Continue as my current team</Button>
        ) : (
          <Button size="lg" onClick={() => void join()}>Try again</Button>
        )}
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href={`/login?code=${code}`} />}>Enter the code by hand</Button>
      </div>
    </Card>
  );
}
