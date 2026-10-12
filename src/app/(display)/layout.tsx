import { redirect } from "next/navigation";
import { getTerminalClaims } from "@/lib/auth/session";

export default async function DisplayLayout({ children }: { children: React.ReactNode }) {
  if (!(await getTerminalClaims())) redirect("/terminal");
  return <div className="pos-root h-screen overflow-hidden bg-background">{children}</div>;
}
