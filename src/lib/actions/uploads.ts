"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";

const UPLOAD_DIR = path.join(process.cwd(), ".data/uploads");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Receipt photos, staff photos, deposit slips. Stored on disk; swap for Supabase Storage in production. */
export async function uploadImage(form: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in" };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a photo" };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "Only JPG, PNG or WebP photos" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Photo is over 4 MB" };
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/api/uploads/${name}` };
}
