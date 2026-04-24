# NEXOR ERP 12-Week Execution Plan

## Goal

Deliver a production-ready multi-user ERP for Angola operations, with AGT-aware compliance controls, no Docker runtime dependency, and reliable branch-scale performance.

## Module Criticality Matrix

### Tier 0 (Business Critical)

- Sales and invoicing
- Inventory and stock movements
- Finance and accounting (journal, chart of accounts, payments)
- Tax and AGT compliance outputs (including SAF-T related flows)
- Authentication, authorization, and audit trails

### Tier 1 (Operational Core)

- Purchasing and suppliers
- Clients and CRM-lite functions
- Daily operational reports and dashboards
- Branch transfers and branch synchronization
- Backup and restore workflows

### Tier 2 (Support and Optimization)

- Budgeting and approvals
- Advanced analytics
- UX polish and non-critical automation
- Extended integrations and connectors

## Priority Rules

- Tier 0 features can block release.
- Tier 1 features can ship in controlled increments.
- Tier 2 features are scheduled only after Tier 0/1 stability gates pass.

## 12-Week Backlog

## Weeks 1-2: Foundation Lock

- Remove Docker runtime coupling from supported deployment path.
- Finalize target production topology and environment policy.
- Create config baseline (`dev`, `staging`, `prod`) with secrets strategy.
- Define migration policy and release checklist.
- Create AGT compliance register (rule owner, source, technical control).

## Weeks 3-4: Core Security and Governance

- Harden auth and role-based access (branch scope included).
- Add immutable audit trail for all critical writes.
- Standardize API errors and trace IDs.
- Implement read-only period lock controls for finance-sensitive endpoints.
- Add protected admin endpoints for operational controls.

## Weeks 5-6: Transaction Integrity

- Enforce transactional boundaries for sales, stock, and accounting writes.
- Add concurrency controls (locking/version checks) for hot tables.
- Add idempotency for high-risk write endpoints.
- Add reconciliation checks between sales, stock, and ledger entries.
- Instrument slow-query and failed-transaction telemetry.

## Weeks 7-8: Branch and Scale Readiness

- Harden branch data boundaries and branch permission model.
- Optimize index strategy for highest write/read pressure endpoints.
- Batch and paginate heavy report queries.
- Add background jobs for long-running report/export generation.
- Execute synthetic load tests with branch-like concurrency.

## Weeks 9-10: Compliance and Reporting Depth

- Finalize AGT report/export validation pipeline.
- Implement fiscal numbering/sequence integrity checks.
- Add compliance anomaly alerts (missing fields, inconsistent totals).
- Improve finance close workflows (period close, controlled reversals).
- Run compliance UAT with accounting stakeholders.

## Weeks 11-12: Release Hardening and Go-Live

- Build production installer/service deployment path.
- Validate backup/restore disaster-recovery drill.
- Complete UAT defect triage and release candidate stabilization.
- Produce runbooks (operations, incident, rollback, upgrade).
- Execute go-live readiness gate and hypercare plan.

## Weekly Deliverable Cadence

- Monday: commit sprint scope and acceptance criteria.
- Wednesday: mid-sprint risk review and technical debt cut list.
- Friday: demo, test evidence, and release gate decision.

## Definition of Done (Per Work Item)

- Code merged with tests for business-critical paths.
- Migration and rollback notes attached if schema changed.
- Audit coverage verified for sensitive writes.
- Performance impact assessed for hot endpoints.
- Documentation updated for operators and support.
