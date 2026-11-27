# Performance rules (permanent)

The till runs all day on a modest Windows PC in Firefox. These rules are not optional. `npm test` checks the first three.

1. **Live updates:** use `useBranchEvents` only (`src/lib/realtime/use-events.ts`). Never `new EventSource` elsewhere. Return the promise of the work. Fallback polls: 15 s or slower; screens that redraw a lot: 60 s or slower.
2. **Sound:** use `playTones` (`src/lib/sound.ts`). Never `new AudioContext` per beep.
3. **Long lists:** never draw hundreds of rows or cards at once. Page them ("Show more"), and give cards `content-visibility: auto`. No per-card layout animations.
4. **Timers / listeners:** every `setInterval`, `addEventListener` and subscription is removed in the effect's cleanup. Nothing refreshes a hidden tab on a timer.
5. **Typing:** filtering large lists goes through `useDeferredValue`.
6. **Service worker:** cache static files and real page loads only, never background data requests.
7. **Server:** the database stays on the same machine as the app. No query inside a loop; no whole-table reads for one page.
8. **Deploys:** use `deploy/update.sh` (builds on the side, the site stays up). Do not build inside the running folder.
9. **Prove it:** after changing a till screen, run `node scripts/perf-check.mjs` (Firefox) and compare the numbers.
