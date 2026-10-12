import { redirect } from "next/navigation";
import { getTerminalClaims } from "@/lib/auth/session";
import { loadStatusBoard } from "@/lib/queries/kds";
import { StatusBoard } from "./status-board";

export default async function StatusPage() {
  const term = await getTerminalClaims();
  if (!term) redirect("/terminal"); // layouts and pages render in parallel, so guard here too
  return <StatusBoard initial={await loadStatusBoard(term.bid)} />;
}
