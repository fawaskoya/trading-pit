import { redirect } from "next/navigation";
import { organiserLoginPath } from "@/lib/paths";

/** Old organiser login URL — kept so bookmarks and printed links still work. */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(organiserLoginPath(next));
}
