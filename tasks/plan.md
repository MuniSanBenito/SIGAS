# Implementation Plan: SIGAS MVP

## Status

**Functional specification:** approved by the user.

**Implementation status:** Gate 0 closed with provisional advance decisions. First vertical slice authorized: auth → mock contributor adapter → family groups. The real municipal adapter remains gated on Infrastructure evidence.

## Overview

Build SIGAS as an internal web application for family-group management, central-warehouse inventory, mixed assistance deliveries, reports, and immutable audit. SIGAS-owned data lives in MongoDB. Contributors remain in the municipal database and are accessed through a dedicated live adapter. Operators use a custom frontend; Administrators may use Payload Admin.

## Source of truth

- Product and architecture specification: `docs/07-ESPECIFICACION-Y-ARQUITECTURA-MVP.md`.
- Data model: `docs/02-MODELO-DE-DATOS.md`.
- Permissions: `docs/04-ROLES-Y-PERMISOS.md`.
- Process flows: `docs/05-FLUJOS-DE-PROCESOS.md`.
- This file orders implementation work after the preflight gates.

## Architecture decisions

1. **MongoDB for SIGAS-owned data:** users, roles, groups, memberships, products, lots, balances, movements, recipes, deliveries, reports, and audit.
2. **Municipal padrón remains authoritative:** no contributor copy in Mongo; live read/write through an isolated adapter.
3. **Stable contributor reference required:** use an immutable municipal ID if available; do not silently use mutable DNI as a Mongo foreign key.
4. **Payload is provisional:** use its Mongo adapter, admin surface, auth primitives, and APIs only after the feasibility spike confirms the external DB integration.
5. **Custom operator frontend:** delivery and group workflows use guided screens, not raw collection editing.
6. **Shared domain invariants:** both the custom frontend and Payload Admin use the same validation, transaction, permission, and audit services.
7. **Vertical slices:** each phase delivers a complete, testable user path instead of building database/API/UI layers in isolation.

## Dependency graph

```text
Gate 0: municipal DB + operational decisions
    |
    +--> Stack feasibility spike (Payload + Mongo + custom frontend + adapter)
              |
              +--> Auth, users, roles, permissions
              |       |
              |       +--> Contributor adapter
              |               |
              |               +--> Family groups
              |                       |
              |                       +--> Products, lots, stock movements
              |                               |
              |                               +--> Bundle versions
              |                                       |
              |                                       +--> Mixed deliveries
              |                                               |
              |                                               +--> Reports + audit hardening
              |
              +--> Future: interventions, semáforo, fichas
```

## Gate 0 — Preflight validation

### Task 0.1: Relevamiento de la base municipal

**Acceptance criteria:**
- [ ] Motor y versión de la base are documented.
- [ ] Contributor table/view, fields, indexes, and stable ID candidate are documented.
- [ ] Read/write permissions and secure VPS connectivity are confirmed.
- [ ] Behavior for duplicate DNI, unknown write result, and unavailable padrón is documented.

**Verification:** review with Infrastructure/database owner; capture a sanitized schema contract without credentials or personal data.

**Dependencies:** None.

**Files likely touched:** `docs/07-ESPECIFICACION-Y-ARQUITECTURA-MVP.md`, `docs/08-CONTRATO-PADRON-MUNICIPAL.md`.

**Scope:** Medium.

### Task 0.2: Cerrar reglas operativas de Depósito

**Acceptance criteria:**
- [ ] Policy for insufficient stock/partial delivery is approved.
- [ ] Policy for correction/reversal of confirmed delivery is approved.
- [ ] Rule for lot expiration, losses, breakage, and adjustments is confirmed.
- [ ] The approved rules are reflected in documents 02, 04, and 05.

**Verification:** sign-off from Depósito and Dirección using concrete examples.

**Dependencies:** None.

**Files likely touched:** `docs/02-MODELO-DE-DATOS.md`, `docs/04-ROLES-Y-PERMISOS.md`, `docs/05-FLUJOS-DE-PROCESOS.md`.

**Scope:** Small.

### Checkpoint: Gate 0

- [ ] Tasks 0.1 and 0.2 approved.
- [ ] No credentials or personal data committed.
- [ ] User explicitly authorizes the feasibility spike.

## Phase 1 — Technical feasibility and foundation

### Task 1.1: Create the application skeleton

**Acceptance criteria:**
- [ ] Approved Payload/Mongo/frontend stack is initialized.
- [ ] Environment variables are documented without committing secrets.
- [ ] Local development and production-like VPS configuration are separated.
- [ ] Placeholder commands for dev, build, lint, and tests are executable.

**Verification:** clean install, development server, production build, and smoke test.

**Dependencies:** Gate 0.

**Files likely touched:** `package.json`, `src/` or approved equivalent, `.env.example`, `tasks/`.

**Scope:** Medium.

### Task 1.2: Implement authentication and user authorization

**Acceptance criteria:**
- [ ] Login accepts normalized DNI and password.
- [ ] Administrator reset forces a password change.
- [ ] Lockout, active/inactive state, and secure sessions work.
- [ ] Roles, permissions, and optional areas are enforced server-side.
- [ ] Login and permission changes are audited.

**Verification:** unit tests for normalization/access; integration tests for login/reset/lockout; frontend smoke test for each initial profile.

**Dependencies:** Task 1.1.

**Files likely touched:** auth collection/config, access-control services, frontend login, tests.

**Scope:** Medium.

### Task 1.3: Build the live municipal contributor adapter

**Acceptance criteria:**
- [ ] Read/search by DNI, CUIT, and approved fields works.
- [ ] Create/update uses the municipal stable ID and approved permissions.
- [ ] Results are `confirmada`, `rechazada`, or `incierta`.
- [ ] Timeouts, bounded retries, idempotency, and audit are implemented.
- [ ] No contributor document is persisted in Mongo as a shadow copy.

**Verification:** integration tests against a sanitized test database; failure-injection tests for timeout, duplicate, rejection, and uncertain result.

**Dependencies:** Tasks 0.1 and 1.1.

**Files likely touched:** `integrations/padron/`, adapter contract, audit service, integration tests.

**Scope:** Large; split if it exceeds one focused session.

### Task 1.4: Implement family groups

**Acceptance criteria:**
- [ ] Group creation requires a valid contributor reference and one active reference person.
- [ ] Memberships store configurable relationship and lifecycle dates.
- [ ] Multiple active memberships show existing groups and require acknowledgment/reason.
- [ ] Group/member deactivation preserves history.
- [ ] Custom frontend supports create/edit/search and current reference address/barrio.

**Verification:** unit tests for membership invariants; integration test from live padrón search to Mongo group; manual role check for Depósito read/correction vs. group-management membership edits.

**Dependencies:** Tasks 1.2 and 1.3.

**Files likely touched:** group collections/services, frontend group screens, tests.

**Scope:** Medium.

### Checkpoint: Foundation

- [ ] Auth, adapter, and groups pass focused tests.
- [ ] A real end-to-end test environment can create a group without duplicating contributors.
- [ ] User reviews the first vertical slice before inventory work continues.

## Phase 2 — Inventory and recipes

### Task 2.1: Implement products, lots, balances, and stock movements

**Acceptance criteria:**
- [ ] Product unit is integer and minimum stock is configurable.
- [ ] Sensitive products can track lot/expiration.
- [ ] Purchase/donation entries update saldo and movement ledger atomically in Mongo.
- [ ] Loss, expiration, breakage, and adjustment exits require a reason.
- [ ] Corrections preserve old/new values in audit.

**Verification:** unit tests for saldo/movement invariants; integration tests for entries/exits/lots; reconciliation test from ledger to saldo.

**Dependencies:** Tasks 1.1 and 1.2.

**Files likely touched:** inventory collections/services, stock screens, audit tests.

**Scope:** Medium.

### Task 2.2: Implement versioned bundle recipes

**Acceptance criteria:**
- [ ] A recipe version stores product quantities as integers.
- [ ] Editing a used recipe creates a new version.
- [ ] Historical versions remain readable and unchanged.
- [ ] Stock projection can expand a recipe against current balances.

**Verification:** unit tests for version immutability and projection; manual check in Payload Admin and custom frontend.

**Dependencies:** Task 2.1.

**Files likely touched:** bundle collections/services, inventory UI, tests.

**Scope:** Medium.

### Checkpoint: Inventory

- [ ] Product entry, lot tracking, adjustment, and recipe versioning are usable.
- [ ] Saldo and movement ledger reconcile after repeated operations.
- [ ] User reviews the inventory slice before deliveries are enabled.

## Phase 3 — Effective mixed deliveries

### Task 3.1: Implement delivery domain and stock confirmation

**Acceptance criteria:**
- [ ] Delivery has exactly one beneficiary target: group or person.
- [ ] Individual without group requires authorization and reason.
- [ ] Third-party receiver must be an existing contributor and be authorized.
- [ ] One delivery supports multiple bundle versions, modified contents, and loose products.
- [ ] Operator explicitly confirms actual product lines and sensitive lots.
- [ ] Confirmation creates consistent stock exits in one Mongo transaction.
- [ ] Delivery date and confirmation timestamp are stored separately.

**Verification:** unit tests for target/receiver/line invariants; integration tests for mixed delivery and stock; acceptance test for group, individual, and third-party flows.

**Dependencies:** Tasks 1.4, 2.1, 2.2, and Task 0.2.

**Files likely touched:** delivery collections/services, stock transaction service, delivery frontend, tests.

**Scope:** Large; split domain, API, and UI into separate vertical tasks if needed.

### Task 3.2: Implement delivery history and operational reports

**Acceptance criteria:**
- [ ] Group-management can read delivery history but cannot mutate it.
- [ ] Stock report shows balance, minimum alerts, lots, and movements.
- [ ] Delivery report filters by period, target, product/bundle, optional area, and reference-person barrio.
- [ ] Future-dated confirmed deliveries are distinguishable from confirmation time.

**Verification:** query tests, permission tests, and manual report review with representative data.

**Dependencies:** Task 3.1.

**Files likely touched:** report queries, frontend report screens, access tests.

**Scope:** Medium.

### Task 3.3: Implement corrections/reversals

**Acceptance criteria:**
- [ ] Uses the policy approved in Task 0.2.
- [ ] No confirmed delivery is silently deleted.
- [ ] Stock compensation/recalculation is auditable and idempotent.
- [ ] Admin and approved Depósito permissions match the final matrix.

**Verification:** failure/retry tests and before/after audit review.

**Dependencies:** Task 0.2 and Task 3.1.

**Scope:** Medium.

### Checkpoint: MVP pilot

- [ ] A pilot can run group creation → inventory entry → versioned recipe → mixed delivery → stock/report review.
- [ ] Permission and audit tests pass for all initial profiles.
- [ ] Backup and restore have been tested on the VPS.
- [ ] User approves the MVP pilot before future interventions are started.

## Phase 4 — Future interventions and coordination

- Interventions by area.
- Fichas, studies, visits, and attachments.
- Semáforo with area/date/count only for cross-area visibility.
- Sensitive intervention access and audit protocols.
- Formal referrals and reports after stakeholder approval.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Municipal DB lacks stable ID or compatible access | High | Fail the feasibility spike early; revise adapter/stack before feature work |
| Cross-database write uncertainty | High | Idempotent adapter, explicit statuses, no shadow contributor copy |
| Stock policy remains undefined | High | Gate delivery implementation on Depósito sign-off |
| Admin permissions bypass invariants | High | Shared domain services and backend access tests |
| VPS/data loss | High | Automated backups, restore drills, monitoring, recovery runbook |
| Sensitive-data exposure | High | Least privilege, TLS, immutable access audit, institutional approval |

## Commands

Exact commands are intentionally pending until the stack feasibility spike creates the project manifest. The first technical task must document executable commands for:

- development server;
- production build;
- lint/format;
- unit and integration tests;
- end-to-end tests;
- local Mongo and test database;
- deployment and backup verification.
