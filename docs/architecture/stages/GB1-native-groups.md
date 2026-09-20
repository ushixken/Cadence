# GB1 — Native Groups

GB1 adds Groups as document-owned relationship metadata over ordinary model-space records. A Group owns no geometry and does not wrap, duplicate, render, snap, measure, or otherwise replace its members.

## Model and authority

The format-v3 document owns a `groups` table. Each entry has the closed shape `{ id, name, memberIds }`. Group IDs come from the same global, non-recycling identity authority as other persisted identities. Member IDs refer only to existing model-space records; feature IDs, record IDs, and geometry remain unchanged when a Group is created or removed.

`CaderactDocument` is the sole mutation authority. Its Group gateway exposes `createGroup(memberIds, options)` and `ungroup(groupId)`. The model reader exposes deterministic `groups()`, `group(groupId)`, and derived `groupForRecord(recordId)` queries. No reverse membership index is persisted.

## Invariants and limits

A Group has at least two and at most 10,000 distinct members. A document has at most 10,000 Groups. Membership arrays use canonical record-ID order. Every member must exist, a record may belong to at most one Group, Groups cannot contain Groups, and Group IDs cannot collide with any persisted identity.

Names are trimmed, non-empty strings of at most 128 characters without control characters and are unique case-insensitively. Default names are `Group 1`, `Group 2`, and so on. The persisted `nextGroupNumber` allocator is transactional and monotonically advances, including when a custom `Group N` name is created, so later creation cannot ambiguously reuse that name. Undo and Redo restore the exact allocator and Group state.

## Lifecycle and history

Create and Ungroup each publish one atomic history entry. Validation occurs before publication; a failed request changes neither document nor history. Ungroup removes only relationship metadata. Undo/Redo replay exact Group IDs, names, canonical membership, and member records without allocating replacement identities.

Low-level record deletion performs Group cleanup in the same transaction: it removes deleted record IDs from membership and dissolves a Group when fewer than two members remain. This protects the persistent invariant without implementing GB2's future group-aware Delete interaction. Ordinary record Copy creates a fresh, ungrouped record.

## Persistence

Strict format-v3 persistence serializes Groups in Group-ID order and preserves IDs, names, member order, and `nextGroupNumber`. Existing v3 files that omit both additions migrate to an empty Group table with the allocator at 1. Malformed graphs are rejected rather than repaired, including duplicate IDs or members, global identity collisions, missing members, multiple membership, invalid names, unsupported fields, invalid order, and complexity-limit violations.

## GB1 exclusions and GB2 surface

GB1 deliberately adds no Group selection, grips, properties UI, rendering, snapping, tracking, measurement, transform, Copy, or user-facing Delete semantics. Existing member records continue through all current CAD systems unchanged. GB2 can build interaction behavior on the reader queries and atomic Group gateway while retaining the document invariants established here. Nested Groups, multiple membership, Block Definitions, and Block Instances remain out of scope.
