# CRSP POS — Proposed Folder Structure

```
crsp_pos/
├─ .env.example
├─ README.md
├─ drizzle.config.ts
├─ next.config.ts / tailwind.config.ts / tsconfig.json (strict)
├─ public/
│  ├─ brand/crsp-logo.svg
│  ├─ sounds/ (kds-new-order.mp3)
│  └─ manifest.webmanifest, sw.js (generated)
├─ messages/                     # next-intl
│  ├─ en.json
│  └─ ur.json
├─ drizzle/                      # generated versioned migrations
├─ scripts/
│  ├─ seed.ts                    # 2 branches, all roles, menu, 30 days orders
│  └─ backup.ts                  # daily pg_dump → storage
├─ src-tauri/                    # Phase 5
├─ print-bridge/                 # Node service: localhost:9101 → TCP 9100 / USB / BT
│  └─ src/{server,escpos,transports}.ts
├─ tests/ (e2e/ playwright, unit via vitest colocated)
└─ src/
   ├─ middleware.ts              # auth + locale + terminal registration check
   ├─ app/
   │  ├─ [locale]/
   │  │  ├─ (auth)/login, pin-login
   │  │  ├─ (pos)/
   │  │  │  ├─ order/            # main order screen
   │  │  │  ├─ held/ payments/ shift/ lock/
   │  │  ├─ (kds)/kds/[station]/
   │  │  ├─ (display)/
   │  │  │  ├─ customer/         # customer-facing 2nd screen
   │  │  │  └─ status/           # TV Preparing / Ready
   │  │  ├─ (rider)/rider/
   │  │  └─ (admin)/admin/
   │  │     ├─ dashboard/ menu/ inventory/ purchasing/ staff/ attendance/
   │  │     ├─ customers/ delivery/ expenses/ reports/
   │  │     └─ settings/{business,branches,terminals,printers,receipts,
   │  │                  tax,payments,loyalty,zones,roles,audit}/
   │  └─ api/
   │     ├─ health, sync/outbox, webhooks/{payments,tax}, cron/{daily-summary,backup}
   ├─ components/
   │  ├─ ui/                      # shadcn
   │  ├─ pos/ (CategoryRail, ItemTile, Cart, PayDialog, ModifierSheet, PinOverride, Numpad)
   │  ├─ kds/ admin/ shared/
   ├─ lib/
   │  ├─ domain/                  # pure, unit-tested business logic
   │  │  ├─ money.ts              # integer paisa helpers
   │  │  ├─ pricing.ts            # lines, modifiers, combos, deals, discounts
   │  │  ├─ tax.ts                # rule resolution
   │  │  ├─ payments.ts           # split payment / split bill / change
   │  │  ├─ orders.ts             # state machine, order numbers
   │  │  ├─ inventory.ts          # recipe deduction, unit conversion, food cost
   │  │  ├─ loyalty.ts shifts.ts permissions.ts
   │  ├─ adapters/
   │  │  ├─ payments/ {types.ts, manual.ts, jazzcash.ts, easypaisa.ts, raast.ts, card-terminal.ts}
   │  │  ├─ printers/ {types.ts, escpos.ts, bridge-client.ts, webusb.ts, webserial.ts}
   │  │  ├─ tax-authority/ {types.ts, fbr.ts, pra.ts, mock.ts, retry-queue.ts}
   │  │  └─ notifications/ {types.ts, sms.ts, whatsapp.ts, email.ts}
   │  ├─ db/ {client.ts, schema/*.ts, rls.sql, queries/}
   │  ├─ auth/ {session.ts, pin.ts, guard.ts}
   │  ├─ offline/ {dexie.ts, outbox.ts, sync.ts, conflict.ts}
   │  ├─ realtime/ {channels.ts, hooks.ts}
   │  ├─ validation/ (zod schemas shared client/server)
   │  ├─ actions/ (server actions grouped by module)
   │  └─ stores/ (zustand: cart, terminal, ui)
   └─ i18n/ {routing.ts, request.ts}
```

## Key decisions
- **Server Actions** for mutations; each calls `requirePermission()` first, then writes an `audit_logs` row for sensitive actions.
- **Postgres RLS** scoped by `branch_id` + role claim in JWT; server actions use a service connection but still check permissions in code (defence in depth).
- **Offline**: POS reads menu from Dexie; orders get client-generated UUIDs + `client_seq`, pushed through an outbox to `/api/sync/outbox`, which is idempotent on UUID. Daily order numbers are allocated per terminal block when offline (e.g. terminal prefix) and reconciled on sync.
- **Print bridge** is separate from Next.js so silent printing works in browser deployments; Tauri embeds the same code in Phase 5.
- **Auth**: Supabase Auth for back-office; POS PIN login issues a short-lived terminal-bound session (PIN hashed with argon2, lockout after 5 failures).
- **Money**: `integer` paisa everywhere; basis points (`integer`) for tax/percent rates.
