# RULES: speed and "the shop never stops"

**Every agent and developer reads this before changing anything.** A change that breaks one of these rules is not finished.
The till is a modest Windows PC, open all day. The internet there fails often.

## 1. Offline first (the shop app, `desktop/`)
- Taking an order, payment, printing, order edit, void, shift and reports must work with the internet cable pulled out.
- Nothing on a selling screen may wait for an outside service. Online work (sync, tax authority, WhatsApp, maps) happens in the background and may fail silently.
- Never load fonts, scripts, images or CSS from the internet at run time. Ship them with the app.
- Never decide "offline" from `navigator.onLine` directly: use `canReachServer()` (`src/lib/desktop.ts`). In the app the server is on the same PC.
- The shop database is real PostgreSQL on the PC (same major version as the website). Never replace it with a store that can lose sales on a power cut.
- The PC is the master copy. Every 2 hours (when there is internet) only new/changed rows go to the website, and new customers come back. Sync never deletes.
- The whole till must work from the keyboard (`src/app/(pos)/order/shortcuts.tsx`). New screens get keys, a small hint and a line in the help list.
- Every slip is saved as a PDF copy before printing; a missing printer must never lose a receipt.
- A download from the website must refuse to run on a PC that already has orders.

## 2. Speed
1. Live updates: `useBranchEvents` only (`src/lib/realtime/use-events.ts`). Never `new EventSource` elsewhere. Return the promise of the work. Fallback polls 15 s or slower; heavy screens 60 s or slower.
2. Sound: `playTones` (`src/lib/sound.ts`). Never `new AudioContext` per beep.
3. Long lists: never draw hundreds of rows or cards at once. Page them, use `content-visibility: auto`. No per-card layout animations.
4. Every timer, listener and subscription is removed in the effect cleanup. No timer redraws a hidden screen.
5. Typing: filtering large lists goes through `useDeferredValue`.
6. Service worker: static files and real page loads only, never background data requests (off in the shop app).
7. Database next to the app. No query inside a loop. No whole-table read for one page.
8. No new heavy dependency or new background process without measuring memory and start-up time before and after.

## Target machine (measure against THIS, not a developer laptop)
HP Z220 SFF: Intel i3-3240 (2 cores, 2012), 8 GB DDR3, SSD, NVIDIA GeForce 210 (no longer supported), Windows 10.
Assume no usable graphics card: no decorative animation, blur or large shadows on selling screens; the app runs in "light graphics".

## 3. Budgets (measure, do not guess)
| What | Limit |
|---|---|
| Saving a cash sale | under 1 s |
| Admin tab showing real data | under 1 s |
| Orders screen elements | under 8,000 |
| Idle till, requests per minute | under 15 |
| Website restart on deploy | under 10 s |

## 4. Releasing
- `npm test` must pass (it checks part of these rules).
- After a till screen change: `node scripts/perf-check.mjs` (Firefox).
- Website: `deploy/update.sh` only (builds on the side; keeps `TimeoutStopSec=4`).
- Shop app: `node desktop/build.mjs win32 && (cd desktop && npm run dist:win)`. Never ship `.env` files or local data inside it.
- A database change needs the website AND the shop app updated together (sync refuses different versions).
