import { redirect } from "next/navigation";
import { getTerminalClaims } from "@/lib/auth/session";
import { PinForm } from "./pin-form";

export default async function PinPage() {
  const term = await getTerminalClaims();
  if (!term) redirect("/terminal");
  return <PinForm />;
}
