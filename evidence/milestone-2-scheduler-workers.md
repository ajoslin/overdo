# Milestone 2 Evidence - Scheduler and Workers

## Contract

- Single-process scheduler dispatches dependency-ready tasks to local workers.
- Concurrency is bounded by configurable max worker count.
- Task leases prevent duplicate claims and stale leases are reclaimable.

## Validation

- Integration: `packages/overdo-core/tests/integration/scheduler-leases.test.ts`
  - bounded non-overlapping dispatch proof
  - stale lease reclaim and task reset proof

## Failure injection

- Lease TTL is forced to expire immediately to simulate worker crash/stale lease.
- Runtime reclaim path restores task to `pending`.
