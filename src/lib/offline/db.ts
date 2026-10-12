"use client";
import Dexie, { type Table } from "dexie";
import type { OutboxRow } from "./types";

class CrspDb extends Dexie {
  outbox!: Table<OutboxRow, string>;
  meta!: Table<{ key: string; value: number }, string>;
  constructor() {
    super("crsp-pos");
    this.version(1).stores({ outbox: "clientId, status, createdAt", meta: "key" });
  }
}

let instance: CrspDb | null = null;
/** Lazily created so server rendering never touches IndexedDB. */
export const localDb = () => (instance ??= new CrspDb());
