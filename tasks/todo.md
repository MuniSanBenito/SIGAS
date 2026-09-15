# SIGAS MVP — Task Checklist

> The functional specification is approved. Gate 0 is closed with provisional advance decisions so the first flow can start. Production still requires Infrastructure and Depósito formal evidence.

## Gate 0 — External validation

- [x] **0.1 Relevar la base municipal**
  - Acceptance: domain contract and adapter states documented; real engine/schema remain pending. First flow uses a mock adapter.
  - Verify: `docs/08-CONTRATO-PADRON-MUNICIPAL.md` records the advance decision.
  - Dependencies: none.

- [x] **0.2 Cerrar reglas de Depósito**
  - Acceptance: deliver available lines without negative stock; annul and recreate confirmed deliveries.
  - Verify: `docs/09-CUESTIONARIO-DEPOSITO.md` and updates in docs 02/04/05/07.
  - Dependencies: none.

- [x] **Gate 0 review**
  - Acceptance: user authorized closing Gate 0 to start the first vertical flow.
  - Verify: specification status updated; first flow is login → contributor search → family group.
  - Dependencies: 0.1, 0.2.

## Phase 1 — Foundation

- [x] **1.1 Initialize approved stack**
  - Acceptance: Payload/Mongo/frontend skeleton exists under `app/` with npm scripts.
  - Verify: `npm install` completed; `npm test` passes adapter/DNI tests.
  - Dependencies: Gate 0.

- [x] **1.2 Authentication and authorization**
  - Acceptance: Users login with DNI as username; roles admin/stock/administracion exist; admin-only Payload Admin.
  - Verify: Users collection configured with official `loginWithUsername`.
  - Dependencies: 1.1.

- [x] **1.3 Municipal contributor adapter**
  - Acceptance: mock adapter searches/creates/updates contributors with confirmada/rechazada and no Mongo copy.
  - Verify: `src/normalizeDni.test.ts` passed.
  - Dependencies: 0.1, 1.1.

- [x] **1.4 Family groups**
  - Acceptance: group creation requires a valid contributor reference and referent; membership warns on multiple active groups with required reason; soft deactivation preserves history.
  - Verify: `src/groups/*`, `/api/grupos`, `/api/parentescos`, tabbed `/grupos` UI, `src/groups/validation.test.ts`, `tests/int/groups-collections.int.spec.ts`.
  - Dependencies: 1.2, 1.3.

- [ ] **Checkpoint: Foundation**
  - Acceptance: users can authenticate and create a valid group without copying contributors into Mongo.
  - Verify: focused test suite and manual pilot flow.
  - Dependencies: 1.1–1.4.

## Phase 2 — Inventory

- [x] **2.1 Products, lots, balances, and movements**
  - Acceptance: integer units, minimums, sensitive lots, purchase/donation entries, non-delivery exits, physical/manual adjustments, logical product deactivation, idempotent commands, and audited corrections foundation.
  - Verify: `pnpm run test:int`, `tests/int/inventory-stock.int.spec.ts`, and responsive E2E coverage.
  - Dependencies: 1.1, 1.2.

- [x] **2.2 Versioned bundle recipes**
  - Acceptance: recipe versions, historical immutability, embedded product lines, and stock projection endpoint/UI.
  - Verify: recipe validation tests, TypeScript/build checks, and inventory workspace E2E flow.
  - Dependencies: 2.1.

- [x] **Checkpoint: Inventory**
  - Acceptance: product catalog, entries, exits, physical counts, lot warnings, responsive stock workspace, and versioned recipe flow are usable and reconcile saldo.
  - Verify: `pnpm run test:int` and `pnpm exec playwright test --config=playwright.config.ts --workers=1`.
  - Dependencies: 2.1, 2.2.

## Phase 3 — Deliveries and reports

- [x] **3.1 Effective mixed deliveries (group destination only)**
  - Acceptance: group-only target (person destination explicitly rejected), member/third-party receiver with authorization reason, multiple bundle versions, loose products, manual lots, real-line stock exits in one Mongo transaction, separate delivery/confirmation dates. Individual destination, area, annulment (3.3), and reports (3.2) remain out of scope.
  - Verify: `src/deliveries/validation.test.ts`, `src/endpoints/entregas.test.ts`, `tests/int/deliveries.int.spec.ts`, e2e role gating in `tests/e2e/roles.e2e.spec.ts`, `pnpm run build`, browser check of grupo → propuesta → confirmar → saldo.
  - Dependencies: 1.4, 2.1, 2.2, 0.2.

- [ ] **3.2 History and operational reports**
  - Acceptance: group-management read-only history, stock reports, delivery filters, optional area/unassigned category, and reference-barrio filters.
  - Verify: query and authorization tests plus manual report review.
  - Dependencies: 3.1.

- [ ] **3.3 Delivery correction/reversal**
  - Acceptance: follows approved policy, never silently deletes, compensates stock idempotently, and audits changes.
  - Verify: correction/retry/failure tests and audit inspection.
  - Dependencies: 0.2, 3.1.

- [ ] **Checkpoint: MVP pilot**
  - Acceptance: group → inventory → recipe → mixed delivery → reports works for the pilot.
  - Verify: end-to-end pilot, permission matrix, backup/restore, and VPS smoke test.
  - Dependencies: 3.1–3.3.

## Phase 4 — Future scope

- [ ] Interventions by area.
- [ ] Fichas, studies, visits, and attachments.
- [ ] Cross-area semáforo.
- [ ] Sensitive access protocols and formal referrals.

## Final delivery gate

- [ ] All tests and build commands pass.
- [ ] No secrets or personal data are committed.
- [ ] Documentation matches the implementation.
- [ ] Audit and backup/restore are verified.
- [ ] User approves the MVP for deployment.
