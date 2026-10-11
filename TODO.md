# To do

- [ ] **Registers page N+1 fetch (PR #34 review).** `src/app/(app)/registers/page.tsx` calls
  `GET /api/branches/:id/registers` once per branch inside `Promise.all` (11 calls for 10 branches).
  `src/app/api/registers/route.ts` only has `POST`, so there is no bulk list.
  Fix: add `GET /api/registers` on the backend (owner sees all registers, manager only those in their
  own branches, same pattern as `GET /api/users`), then switch the page to one call and filter by
  `branch` in the page. Needs a route, `RegisterService.getRegisters`, and
  `RegisterRepository.getRegisters`. Open question: `backend` (PR #17) and `review` (base of the
  frontend stack) have diverged, so decide which branch carries it.
