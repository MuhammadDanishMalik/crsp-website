/** Helpers for the installed Windows app, where the whole POS server and database run on the shop PC itself. */
export type DesktopBridge = { print: (html: string, paperMm: number, heightMm: number) => Promise<{ ok: boolean; error?: string }> };

export const desktopBridge = (): DesktopBridge | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { crspDesktop?: DesktopBridge }).crspDesktop);

/** Can the POS reach its server? In the installed app the server is on this PC, so a dead internet line does not matter. */
export const canReachServer = (): boolean => !!desktopBridge() || typeof navigator === "undefined" || navigator.onLine;
