import { loadPublicMenu } from "@/lib/queries/menu";
import { KfcHomeClient } from "@/components/home/kfc-home-client";
import { redirect } from "next/navigation";
import { getSession, getTerminalClaims } from "@/lib/auth/session";

export const revalidate = 0; // Dynamic for real-time menu availability

export default async function HomePage(props: {
  searchParams?: Promise<{ pos?: string; portal?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  
  // Optional bypass to launch POS / Staff directly
  if (searchParams?.pos === "1" || searchParams?.portal === "1") {
    const s = await getSession();
    if (!s) redirect((await getTerminalClaims()) ? "/pin" : "/start");
    if (s.kind === "admin") redirect("/admin");
    if (!s.can("order.create") && s.can("kds.view")) redirect("/kds");
    if (!s.can("order.create") && s.can("delivery.view_assigned")) redirect("/rider");
    redirect("/order");
  }

  // Load public menu from database
  const menu = await loadPublicMenu();

  return <KfcHomeClient menu={menu} />;
}
