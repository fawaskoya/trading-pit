import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Organiser login" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="pit-hero min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-3xl font-extrabold">Organiser login</h1>
        <p className="mt-2 text-muted-foreground">Sign in to set up and run your event.</p>
        <Card className="mt-6 p-6">
          <LoginForm next={next ?? "/admin"} />
        </Card>
      </main>
    </div>
  );
}
