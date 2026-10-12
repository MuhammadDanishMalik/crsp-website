/** Browser → local print bridge (localhost). The server never talks to printers directly. */
export const BRIDGE_URL = process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL ?? "http://127.0.0.1:9101";

export type PrinterTarget = { connection: "lan" | "usb" | "bluetooth" | "serial"; address: string | null; port: number | null };

const toBase64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** Inside the desktop (Tauri) app the printer is reached directly; in a browser we go through the local print bridge. */
type TauriGlobal = { core?: { invoke?: (cmd: string, args: Record<string, unknown>) => Promise<unknown> } };
const tauri = () => (typeof window === "undefined" ? undefined : (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__?.core?.invoke);

export async function sendToBridge(target: PrinterTarget, data: Uint8Array): Promise<{ ok: boolean; error?: string }> {
  const invoke = tauri();
  if (invoke) {
    try {
      if (target.connection === "lan") await invoke("print_raw", { host: target.address, port: target.port ?? 9100, dataB64: toBase64(data) });
      else if (target.connection === "serial" || target.connection === "bluetooth") await invoke("print_serial", { port: target.address, baud: target.port ?? 9600, dataB64: toBase64(data) });
      else return { ok: false, error: `${target.connection} printers are not supported yet` };
      return { ok: true };
    } catch (e) { return { ok: false, error: typeof e === "string" ? e : "Printer error" }; }
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, data: toBase64(data) }), signal: AbortSignal.timeout(4000),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok && j.ok ? { ok: true } : { ok: false, error: j.error ?? `Bridge error ${res.status}` };
  } catch {
    return { ok: false, error: "Print bridge not running" };
  }
}

export async function bridgeAlive(): Promise<boolean> {
  if (tauri()) return true;
  try { return (await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
