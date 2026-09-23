# DS1 — Extension Tracking, Parallel Audit, and Insertion Osnap

DS1 preserves the single `SnapResolver` and `ObjectSnapTracking` authorities.

- **Insertion** is a direct semantic Osnap derived only from model-owned Text and Block Instance insertion points. It participates in ordinary mode enablement, ranking, markers, labels, resolved command points, and Dynamic Input. It is not a tracking acquisition origin.
- **Extension** is a tracking-derived ray. After the existing dwell acquisition of a Line endpoint or terminal open-Polyline vertex, the tracking controller can project beyond that endpoint along the source segment direction. It never creates document geometry or a direct Osnap candidate. The renderer-neutral overlay draws its guide as a forward ray.
- **Parallel** remains the existing `OnParallel` behavior based on the latest accepted drafting segment. The audit found no duplicate authority: direct semantic Osnaps still preempt Parallel, the custom crosshair remains at the raw pointer, and marker/HUD/preview use the resolved tracking point.

Insertion and Extension enablement are user preferences. Extension also requires the Track master mode. Preference changes persist without affecting document revision, history, dirty state, or native persistence.
