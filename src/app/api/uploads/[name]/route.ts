import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 }); // blocks path traversal
  try {
    const buf = await fs.readFile(path.join(process.cwd(), ".data/uploads", name));
    return new Response(buf, { headers: { "Content-Type": MIME[name.split(".")[1]], "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
