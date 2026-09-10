import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { NewEventForm } from "./new-event-form";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-extrabold">Set up your event</h1>
        <p className="mt-1 text-muted-foreground">You can change all of this later from Settings.</p>
        <Card className="mt-6 p-6"><NewEventForm /></Card>
      </main>
    </div>
  );
}
