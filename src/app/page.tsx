import { redirect } from "next/navigation";
import { getSession, getTerminalClaims } from "@/lib/auth/session";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect((await getTerminalClaims()) ? "/pin" : "/start");
  if (s.kind === "admin") redirect("/admin");
  if (!s.can("order.create") && s.can("kds.view")) redirect("/kds");
  if (!s.can("order.create") && s.can("delivery.view_assigned")) redirect("/rider");
  redirect("/order");
}
