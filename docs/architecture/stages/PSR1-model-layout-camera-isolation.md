# PSR1 — Model/Layout camera isolation

Model Space and each Layout own independent ephemeral editor-camera snapshots.
The snapshot contains the existing authoritative camera zoom and screen-space
pan coordinates; it is not document geometry, Layout viewport state, history,
native persistence, or workspace preference data.

On a context switch the Viewport stores the outgoing camera, then restores the
incoming context's last camera. A Layout with no prior editor camera retains the
PS2 physical-sheet auto-fit behavior. That fit initializes only the Layout's
camera and cannot overwrite the stored Model view. Repeated Model/Layout and
Layout/Layout switching therefore performs exact state restoration without
numeric drift.

Document replacement clears all context-camera snapshots and initializes the
new document's Model camera through the existing default centered-view policy.
This prevents New, Open, DXF import, or Recovery from inheriting navigation
state from the replaced document. Camera changes continue to invalidate only
camera-dependent projection and overlays; the PERF2B stable world-geometry
cache boundary remains unchanged.
