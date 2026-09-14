# P9 — Object Snap acquisition reliability

## Root cause and arbitration

Candidate generation was correct. Every semantic candidate used the established 10 CSS-pixel aperture, but `Viewport` consumes `SnapResolver.objectSnap` as the direct-Osnap authority. That field was chosen by raw screen distance before semantic priority, so a curve-projected Nearest candidate—often 0–1 px away—replaced an Endpoint, Center, or Intersection still legitimately inside its aperture.

Direct object arbitration now uses three tiers: exact features (Endpoint, Vertex, Intersection, Midpoint, Center, Quadrant), contextual relationships (Perpendicular, Tangent), then fallback Nearest. Within a tier, screen distance, existing priority, and stable identity remain deterministic. Candidate generation, the 10 CSS-pixel aperture, compound same-point deduplication, and candidate count are unchanged.

## Authority and interaction

The resolved direct semantic point remains ahead of P8 tracking; tracking remains ahead of Grid and constrained/free movement. Grid is continuous and independent, including when the Osnap master is off. Compound `kinds` and references remain attached to the single winning point.

Caderact hides the native pointer and draws its own CAD crosshair. During active point acquisition, the custom cursor represents the final authoritative model point that a click will accept. `Viewport` projects that point into the overlay host's screen space after direct object snapping, object tracking, Grid quantization, and Ortho/Polar constraint resolution. The snap marker, preview, Dynamic Input values, and accepted point therefore share the same model coordinate. The physical OS pointer is never warped; leaving the viewport hides the drawn crosshair according to its existing lifecycle.

The change adds no geometry work or candidates per pointer move, so runtime complexity is unchanged. Visible locked records remain snap sources, hidden records do not, and Nearest remains ineligible as a tracking acquisition origin under the existing P4/P8 policy.
