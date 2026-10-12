# CRSP POS

Point of sale and restaurant management for CRSP. Phases 1–5: PIN login, roles, menu management, POS order screen, payments (cash/card/wallets/Raast, split payment and split bill), receipts and kitchen tickets, shifts, kitchen display, TV status screen, customer display, hold/recall, promo codes, voids and refunds with manager approval, staff/attendance/payroll, inventory with recipes and automatic stock deduction, purchasing, expenses and a simple P&L, a live dashboard, 14 reports with PDF/Excel/CSV export, customers and loyalty points, delivery with a rider app and cash settlement, and multi-branch.

## Run locally
```bash
npm install
npm run dev            # http://localhost:3000 — embedded database, seeded on first visit
```
1. Open `/terminal`, enter terminal code **POS1-DEV**.
2. PINs: owner 1111 · manager 2222 · cashier 3333 · order taker 4444 · kitchen 5555 · rider 6666 · accountant 7777.
3. Back office: `/login` — `owner@crsp.test` / `admin123` (other roles: `cashier@crsp.test` etc., same password). **Change these before going live.**

To use Supabase/Postgres, set `DATABASE_URL` (see `.env.example`). Schema changes: edit `src/lib/db/schema.ts`, run `npm run db:generate`.

## Printing
Run `npm run bridge` on the POS machine (raw TCP to LAN thermal printers on port 9100). Set the printer IP in the `printers` table (use Admin → Printers & kitchen). If the bridge is down, use **Browser print** on the paid screen. USB/Bluetooth need the Tauri app (Phase 5).

## Screens
| URL | For |
|---|---|
| `/order` | Cashier order screen (also `/orders` for today's orders, void/refund, reprint) |
| `/kds` , `/kds?station=<id>` | Kitchen display. Log in with the kitchen PIN (5555) |
| `/status` | TV "Preparing / Ready" board. Only needs a registered terminal, no staff login |
| `/customer` | Customer-facing display. Open on the second monitor of the **same PC** as the POS (mirrors the cart via BroadcastChannel) |
| `/admin/printers` | Printers, test print, kitchen stations, category → station routing |

Realtime uses server-sent events from the Next.js server (single instance) with polling fallback; swap `src/lib/realtime/bus.ts` for Supabase Realtime if you run several instances.

Promo codes in the demo data: `WELCOME10` (10%), `STAFF` (staff meal 50%, needs permission).

## Back office (Phase 3)
| Page | What it does |
|---|---|
| `/admin/staff` | Add/edit/deactivate staff, photo, CNIC, PIN (unique per branch), salary |
| `/admin/attendance` | Daily attendance, manual fixes, weekly schedules. Staff clock in/out with their PIN via **Clock in / out** on the PIN screen |
| `/admin/payroll` | Monthly payroll summary (days, hours, advances, deductions) with CSV download; cashier performance |
| `/admin/inventory` | Stock, low-stock and expiry alerts, stock count, wastage, branch transfers, movement log |
| `/admin/recipes` | Recipe per menu item and **food cost %** |
| `/admin/purchasing` | Suppliers (balances), purchase orders, receiving with batch/expiry/freight/duty (landed cost) for imported goods, supplier payments |
| `/admin/expenses`, `/admin/accounts` | Expenses with receipt photos, bank deposits, day-end cash summary, P&L |

Each sale deducts recipe ingredients (including sauce add-ons) and stores the recipe cost on the order line; voiding an order puts the stock back. Recipes, ingredient costs and opening stock in the demo data are placeholders.

`CRSP_NO_SEED=1` skips the demo data on an empty database (production start).

## Phase 4
| Where | What |
|---|---|
| `/admin` | Live dashboard: sales, orders, average order, sales by hour, top items, payment method, order type. Branch and date switcher |
| `/admin/reports` | 14 reports with date range and branch filters. Export to Excel, PDF or CSV. `/api/reports/<key>?from=&to=&branch=&format=` |
| `/admin/customers` | Customer list, history, points ledger, manual point adjustments. Loyalty rules in Settings |
| `/delivery` (POS) | Delivery board: assign riders, receive the cash a rider is holding |
| `/rider` | Mobile rider screen: picked up, delivered with cash collected, couldn't deliver. A rider logs in with their PIN on a phone that has been registered as a terminal (Admin → Settings → Terminals) |
| `/admin/branches` | Add/edit branches, switch branch from the sidebar. Per-branch prices via Menu → Branch price |

- **Cash on delivery:** on the PAY screen of a delivery order. It is not till cash until the rider hands it over; settlement adds it to the receiving cashier's shift.
- **Loyalty:** earn on what the customer pays, redeem at the PAY screen once the customer's phone is entered. Voiding an order reverses the points.
- **Daily summary:** Settings → Daily summary to the owner. Call `GET /api/cron/daily-summary` every ~10 minutes from any scheduler with `Authorization: Bearer $CRON_SECRET`. Email needs `RESEND_API_KEY` + `MAIL_FROM`; WhatsApp needs `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`. Without them messages are only logged. The real email/WhatsApp calls have not been run against live accounts.
- **Demo data:** the first start seeds 30 days of sample orders so reports are not empty. Set `CRSP_NO_DEMO_HISTORY=1` (or `CRSP_NO_SEED=1`) to skip.

## Phase 5
**Offline.** Once a till has been opened online it keeps working with no internet (production build registers `public/sw.js`; in development set `NEXT_PUBLIC_ENABLE_SW=1`). Sales are saved in the browser (IndexedDB), printed from local data, numbered with the terminal's letter (A001, B001…), and uploaded in order when the connection returns. Each sale has its own id, so a retry can never create a duplicate. Not available offline: discounts, loyalty points, cash on delivery, gateway payments. Card/wallet money taken offline is flagged "pending verification". If the server rejects an offline sale (for example the shift or an item was deleted) it stays in the *Orders saved on this device* list marked "need attention".
**Kitchen display offline:** the KDS needs the POS server. For a shop whose internet is unreliable, run the app on a PC inside the shop (same Wi-Fi) so the KDS and tills keep talking even when the internet is down.

**Tax authority (FBR / PRA).** Branch → *Tax authority* (Admin → Branches). Every sale gets an invoice number + QR; if the authority is down the sale still completes and the invoice waits in **Admin → Tax invoices** and retries by itself (needs a scheduler calling `GET /api/cron/tax-queue`). Credentials go in `.env` (`FBR_API_URL`, `FBR_TOKEN`, …). The adapter posts our neutral invoice JSON and reads the invoice number/QR from configurable response fields — the exact FBR/PRA request format must be mapped in `src/lib/adapters/tax-authority/rest.ts` once you have their documentation. Without credentials, development uses a **mock** (numbers like `MOCK-MWL-20261007-012`, never filed); production keeps invoices queued instead of inventing numbers. Voiding a filed sale asks the authority to cancel and flags the row if it cannot (issue a credit note manually).

**Payment adapters.** `src/lib/adapters/payments`: every provider implements `initiate / confirm / refund / getStatus`. `manual` (default) is the cashier typing the code. Admin → Settings → Payment methods lets you switch a method to a mock gateway to try the flow. To plug in JazzCash/Easypaisa/a bank terminal: copy `mock-gateway.ts`, call their HTTP API with credentials from `.env`, register it in `index.ts`.

**Other.**
- Idle lock after N minutes (Settings → Business), auto sign-out after 4× that (min 20 min).
- Urdu: tap **اردو** on the PIN screen or POS top bar (till screens, item names and the receipt thank-you; the back office is English only). Language is saved per device.
- Daily backup: call `GET /api/cron/backup` once a day (embedded database: keeps 14 copies in `.data/backups`; Supabase/Postgres: use the provider's backups).
- `docs/CASHIER-GUIDE.md` is the one-page guide for staff.
- **Desktop app (`src-tauri/`)**: kiosk window + direct LAN/serial printing without the print bridge. `CRSP_URL=http://shop-pc:3010/start npm run desktop:dev`. **Not compiled here** (no Rust toolchain on the build machine): install Rust + `cargo install tauri-cli`, run `cargo tauri icon public/brand/icon-512.png`, then expect to fix small API differences the compiler reports. USB-only printers are not supported yet.
- Not done: Sentry (crashes are logged to the server console via `/api/client-error`), full Urdu back office, offline KDS without a local server.

## Checks
`npm run typecheck && npm run lint && npm test && npm run test:e2e`

## Cashier quick guide
- Tap a category, tap an item (required options are pre-selected), tap **PAY**, tap **Exact** or a note amount, **Complete order**.
- F2 search/scan · F4 pay · F8 discount. Discounts above your limit ask for a manager PIN.
- End of day: **Shift → Close shift**, count the drawer and enter the total.

## Notes
- Menu names come from the CRSP menu card; **prices are placeholders** — set real ones in Admin → Menu. Tax rate (16%) is a placeholder — set in Admin → Settings.
- Not yet built (later phases): full reports and dashboard, Excel/PDF export (payroll is CSV for now), offline sync, FBR/PRA, Urdu UI, Tauri.
