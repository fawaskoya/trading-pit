"use client";
import { useState } from "react";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OrganiserForm } from "./organiser-form";
import { TeamForm } from "./team-form";

export type LoginRole = "team" | "organiser";

const ROLES: { id: LoginRole; label: string; icon: typeof Gamepad2; blurb: string }[] = [
  { id: "team", label: "Team", icon: Gamepad2, blurb: "Playing today? Enter the code your organiser gave you." },
  { id: "organiser", label: "Organiser", icon: ShieldCheck, blurb: "Set up companies and headlines, then run the rounds." },
];

export function LoginCard({ initialRole, code, next }: { initialRole: LoginRole; code?: string; next: string }) {
  const [role, setRole] = useState<LoginRole>(initialRole);
  const active = ROLES.find((r) => r.id === role)!;

  return (
    <Card className="mt-6 p-6">
      <div role="tablist" aria-label="Sign in as" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {ROLES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={role === id}
            aria-controls={`panel-${id}`}
            onClick={() => setRole(id)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              role === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{active.blurb}</p>
      <div role="tabpanel" id={`panel-${role}`} aria-labelledby={`tab-${role}`} className="mt-5">
        {role === "team" ? <TeamForm initialCode={code} /> : <OrganiserForm next={next} />}
      </div>
    </Card>
  );
}
