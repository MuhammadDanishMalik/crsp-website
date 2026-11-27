import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guard rails from docs/PERFORMANCE.md: these mistakes made the till hang after a few hours.
const root = path.join(process.cwd(), "src");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !n.includes(".test.") ? [p] : []; });
const files = walk(root).map((p) => ({ file: path.relative(root, p), code: readFileSync(p, "utf8") }));
const offenders = (re: RegExp, allowed: string) => files.filter((f) => re.test(f.code) && f.file !== allowed).map((f) => f.file);

describe("performance rules", () => {
  it("only the shared live-events hub opens an EventSource", () => expect(offenders(/new EventSource\(/, "lib/realtime/use-events.ts")).toEqual([]));
  it("only the shared sound helper creates an AudioContext", () => expect(offenders(/new AudioContext\(/, "lib/sound.ts")).toEqual([]));
  it("offline is never judged from navigator.onLine alone (the shop app's server is on the same PC)", () => expect(offenders(/!navigator\.onLine|\(navigator\.onLine\)/, "lib/desktop.ts")).toEqual([]));
  it("nothing is loaded from the internet at run time", () => expect(files.filter((f) => /(src|href)=["']https?:\/\/[^"']+\.(js|css|woff2?)["']|@import url\(["']?https?:/.test(f.code)).map((f) => f.file)).toEqual([]));
  it("the orders screen never renders the whole list at once", () => expect(files.find((f) => f.file === "components/orders/orders-manager.tsx")!.code).not.toMatch(/filteredOrders\.map\(/));
});
