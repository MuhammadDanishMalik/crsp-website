"use client";
import { logout } from "@/lib/actions/auth";

/** Signs out, then goes to the PIN screen in the browser (a server-side redirect can point at the wrong host behind a proxy). */
export function LogoutForm({ children }: { children: React.ReactNode }) {
  return <form action={async () => { await logout(); window.location.assign("/pin"); }}>{children}</form>;
}
