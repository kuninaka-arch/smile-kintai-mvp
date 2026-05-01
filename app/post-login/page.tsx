import { redirect } from "next/navigation";
import { requireAuth } from "@/components/RequireAuth";

export default async function PostLoginPage() {
  const session = await requireAuth();

  if (session.user.role === "ADMIN") {
    redirect("/select");
  }

  redirect("/home");
}
