/** Tiny in-memory cache for the till menu (the same for every cashier): saves ~10 database round trips on each page load. */
const g = globalThis as unknown as { __crspMenuCache?: Map<string, { at: number; value: unknown }> };
const store = (g.__crspMenuCache ??= new Map());
const TTL_MS = 10_000;

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}
export const clearMenuCache = () => store.clear();
