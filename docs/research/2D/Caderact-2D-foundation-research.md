# Caderact: 2D CAD foundation research and product specification
Research date: 5 September 2026. Target references: Rhino 8 and AutoCAD 2026.

## Reading this document

This is a research and proposed specification, not an implementation or a certification of current Caderact behavior. No repository files were changed. The companion [command matrix](Caderact-2D-command-matrix.md) catalogs the requested capabilities, equivalents, proposed options, aliases, dependencies, and priorities.

**Documented** means supported by the linked official documentation. **Recommendation** means a proposed Caderact decision. **Unresolved** means the available evidence does not justify a definitive claim. This is documentation research, not hands-on testing in licensed Rhino and AutoCAD installations. Product defaults can be overridden by profiles, templates, platforms, and command state. Sources from AutoCAD LT or Mac are labeled by their URL; their descriptions establish the stated behavior in those editions, not every desktop configuration. No behavior is inferred from AutoCAD Web as if it were desktop AutoCAD 2026.

The inventory covers every capability family requested. It is not an exhaustive transcription of every command prompt or every product command. Where an exact counterpart or algorithm was not established, the matrix says so. Proposed options in the matrix belong to Caderact and must not be read as a verbatim vendor option list.

## 1. Executive summary

Build a document and geometry foundation before adding more drafting toggles. The key boundaries are: geometry versus display; physical units versus formatted numbers; saved objects versus transient previews; selection versus snapping; and measured values versus annotation text.

Rhino distinguishes one Line, multiple adjoining Lines, and a Polyline. AutoCAD LINE likewise makes separate segment objects, whereas PLINE makes one object with line and arc segments. Caderact should keep the existing continuous Line workflow and add Polyline as a distinct object-producing command. [Rhino Line/Lines][RL], [Rhino Polyline][RP], [AutoCAD LINE][AL], [AutoCAD PLINE][AP].

Recommended foundations:

- Stable object IDs and undoable document transactions.
- Double-precision model data; renderer buffers are disposable approximations.
- Explicit physical unit metadata and separate display, paper, and annotation formatting.
- A single point-input resolver shared by every tool.
- Separate visual grid, grid-snap lattice, object snaps, and angle constraints.
- Analytic lines/arcs/circles and structured paths; display tessellation never becomes the geometry database.
- A declared exchange subset with measurable round-trip tests.

Make DXF the first CAD interchange target, following native document save/load. SVG and PDF are useful publishing formats, but should not define the editable model. Use 3DM later for richer curve exchange; approach DWG with an evaluated SDK or service strategy.

## 2. Complete 2D capability taxonomy

| Capability family | Required coverage |
|---|---|
| Creation | Point; single and continuous independent lines; polyline; rectangle; polygon; circle; arc; ellipse/elliptical arc; control-point and interpolated spline; freehand; construction line; ray; infinite line; extracted boundary; region; revision cloud; hatch; solid/gradient fill |
| Transforms | Move; Copy; Rotate; Scale; Mirror; Align/orient; rectangular, polar, and path arrays |
| Shape editing | Offset; Trim; Extend; Split; Break; Join; Explode; Fillet; Chamfer; Stretch; Lengthen; vertex/control-point edits; reverse; simplify; rebuild; match continuity |
| Selection | Click; additive/removal; window; crossing; fence; polygon/lasso; all; previous; invert; similar; by type/layer/property; filters; subobjects; overlap cycling; preselection/postselection |
| Organization | Layers and inheritance; visibility/lock; hierarchy; states/isolate; groups; block definitions/instances; object names; metadata |
| Properties | Type-specific geometry; coordinates; derived measurements; layer; color; linetype; lineweight; transparency; metadata; overrides |
| Annotation | Text; leaders/multileaders; notes; tables; center marks/lines; styles; scale behavior |
| Dimensions | Linear; aligned; angular; radius; diameter; arc length; ordinate; baseline; continued; styles; tolerances; alternate units; associativity; edit/reassociate |
| Measurement | Distance; curve length; area; perimeter; angle; radius/diameter; point coordinates; geometry diagnostics; divide/count and interval placement |
| Precision | Units; input grammar; floating-point policy; operation tolerances; grid; grid snap; object snap; Ortho; polar/angle constraints; tracking |
| Navigation/document | Pan; zoom variants; named/previous views; templates; native persistence; layout/print settings; exchange |

The companion matrix supplies command-level detail. The taxonomy is a product scope, not a claim that all capabilities share identical native entities in both products.

## 3. Rhino 8 findings

Rhino organizes much of its 2D work around curves, construction planes, modeling aids, and object properties. This fits a geometry-centered editor, but does not justify treating all curves as interchangeable.

Documented distinctions: Line creates one segment; Lines creates adjoining separate objects. Curve takes control points; InterpCrv takes points the curve passes through. Join can produce a polycurve without making its component degrees identical. These distinctions matter for selection, end snaps, explode, and exchange. [Line][RL], [Curve/InterpCrv][RC], [Join](https://docs.mcneel.com/rhino/8/help/en-us/commands/join.htm).

Rhino's grid belongs to a construction plane and can be configured for the active viewport or all viewports. Object-snap settings include behavior for locked and filtered objects; visibility, selectability, and snappability therefore are separate concerns. [Grid][RG], [Modeling aids][RA].

SmartTrack creates temporary references for point acquisition. Dimensions can use History, with annotation History recorded by default in Rhino 8. Do not repeat older blanket claims that Rhino dimensions are non-associative. [SmartTrack][RT], [History][RHIS].

Recommendation: adopt the distinction between exact model objects and temporary acquisition aids. Adapt Rhino's many specialized commands into understandable Caderact tool families without hiding meaningful geometry differences.

## 4. AutoCAD 2026 findings

AutoCAD's 2D workflow combines command prompts, entity types, layer inheritance, object grips, drafting aids, styles, and model/paper spaces. LINE and PLINE deliberately have different object semantics. The distinction between a polyline's geometric width and a plotted lineweight must also survive import and editing. [PLINE][AP].

UNITS controls display conventions; INSUNITS controls automatic scaling on insertion. Architectural and Engineering display assume inches as the underlying drawing unit. Changing displayed precision does not quantize geometry. [Drawing Units][AU], [INSUNITS][AINS], [Basics, LT Mac][AB].

Command execution has context-dependent options and transparent commands. Selection and snapping have distinct cycling mechanisms; keyboard coordinates can take precedence over running snaps according to settings. [Command line, LT Mac][AK], [Precise points][ASP], [User preferences, LT][APREF].

Recommendation: adopt predictable typed workflows and editable semantic entities. Avoid exposing a large collection of historical system variables as Caderact's primary settings UI.

## 5. Units and measurement specification

### 5.1 Seven independent concepts

| Concept | Meaning | Proposed Caderact ownership |
|---|---|---|
| Model unit | Physical interpretation of numeric geometry | Document, explicit unit ID and metres-per-unit |
| Display unit/format | How a value is presented: decimal, fractional, feet/inches | Document default plus user viewing override |
| Display precision | Rounding used to print a number | Formatting/style setting |
| Actual numeric precision | Representation and computational error | Geometry implementation; not a decimal-place dropdown |
| Insertion unit | Physical interpretation of incoming data and conversion ratio | Import metadata and per-import decision |
| Layout/paper unit | Physical sheet dimensions and print-scale definition | Layout; initially mm or inches |
| Annotation unit | Unit and formatting used in dimension labels | Annotation style/override |

Documented: Rhino separates model/layout units and custom unit scale; AutoCAD separately exposes length format and insertion units. [Rhino Units][RU], [AutoCAD Drawing Units][AU].

### 5.2 Supported units and input

Rhino documents microns, mm, cm, m, km, inches, feet, miles, microinches, mils, and fractional/feet-inch input; its wider list includes nanometres, angstroms, decimetres, dekametres, hectometres, megametres, gigametres, yards, printer points/picas, nautical miles, and astronomical units. Custom units specify metres per custom unit. [Rhino Units][RU].

AutoCAD INSUNITS includes mm/cm/m/km, microns/nanometres/angstroms, inches/feet/yards/miles, microinches/mils, decimetres/dekametres/hectometres/gigametres, and astronomical units. US survey feet need distinct handling; survey inches/yards/miles are documented as Mac-only settings. Unitless is also an explicit state. This is an insertion-unit enumeration, not proof of accepted command-input suffixes. [INSUNITS][AINS].

**Recommended initial menu:** mm, cm, m, in, ft, with feet-and-inches offered as a display format. Keep advanced units accessible without crowding the primary menu. Recognize nm, micrometres, km, and survey-unit metadata on import once supported, even before offering them as common new-document choices.

**Proposed Caderact parser examples, in an mm document:**

| Input | Result | Interpretation |
|---|---:|---|
| 100mm | 100 | Explicit mm |
| 25cm | 250 | Explicit cm |
| 2m | 2000 | Explicit metres |
| 1.5km | 1,500,000 | Explicit kilometres |
| 12in | 304.8 | International inches |
| 3ft | 914.4 | International feet |
| 6'4" | 1930.4 | 6 feet + 4 inches |
| 1-1/2" | 38.1 | Mixed fraction inches |
| 1m + 25mm | 1025 | Later: dimensionally valid expression |
| 100 | 100 | Current input unit; explicitly shown |

Rhino documents unit-aware distances and mixed fractional/decimal notation. These examples define Caderact's proposed acceptance tests; do not assume AutoCAD accepts every metric suffix at a raw LINE point prompt. AutoCAD exposes unit conversion through facilities such as cvunit, but that is different from universal prompt parsing. [Rhino input][RK], [Autodesk unit conversion](https://help.autodesk.com/cloudhelp/2026/DEU/AutoCAD-AutoLISP/files/GUID-8256416C-3302-4BBF-B4C9-98A7973FBC96.htm).

Recommendation: convert typed quantities at input boundaries, preserve adequate digits, reject unknown suffixes, and never interpret a partially parsed value silently. A negative sign applies to the complete feet-inch quantity. Area conversion uses the square of the linear conversion ratio. Provide a canonical command grammar independent of locale; localize formatted display. Resolve decimal comma versus coordinate comma before release.

### 5.3 Changing units

**Rhino documented:** asks whether to scale existing geometry when changing unit systems. **AutoCAD documented:** changing UNITS display formatting is different from insertion conversion. Do not describe a format change as automatic rescaling of existing coordinates. [Rhino Units][RU], [AutoCAD Basics][AB].

For 1000 mm:

| Operation | Numeric result | Physical result |
|---|---:|---|
| Convert geometry mm → m, preserving size | 1 | 1 metre |
| Reinterpret coordinates as metres | 1000 | 1000 metres |
| Change only display to metres | Internal value unchanged | Display 1 m |

Recommendation: the ordinary **Display units** control never changes geometry. A separate **Change model units** action defaults to preserving physical size and previews the conversion. **Reinterpret units** is a clearly named repair operation, useful for misdeclared imports.

If model coordinates are stored in document units, size-preserving conversion must cover geometry, block transforms/definitions, grid/snap distances, operation tolerances, hatch lengths/origins, and model-space annotation offsets. Dimensionless scale factors do not change. Sheet sizes remain physically constant. Convert the document atomically with one undo step. Do not convert every block occurrence independently and then scale its definition again.

Autodesk support documents -DWGUNITS workflows, but availability/toolset differences and their prompts require a desktop verification fixture before claiming one uniform AutoCAD unit-change transaction. [Autodesk insertion-scaling support](https://help.autodesk.com/view/ACADWEB/ENU/?caas=caas%2Fsfdcarticles%2Fsfdcarticles%2FBlocks-xrefs-or-raster-images-are-scaled-when-inserted.html).


### Angle formats and constraints

**Documented:** AutoCAD's -UNITS exposes decimal degrees, DMS, grads, radians, and surveyor bearings, with separate angular display precision and configurable zero direction and clockwise measurement. Its documented default is east-zero, counterclockwise-positive. This reference is AutoCAD 2026 LT for Mac. [Angle formatting][AANGLE].

**Documented:** Rhino accepts angle constraints in degrees, DMS, radians, and grades. A direction constraint is distinct from a distance constraint; they can be combined. [Rhino precise input][RI].

**Caderact recommendation:**

| Concern | Initial contract | Later extension |
|---|---|---|
| Internal value | Radians; Float64; preserve signed sweep for arcs | No storage change for new display formats |
| Display/input | Decimal degrees by default; explicit deg and rad suffixes | DMS and grad suffixes; surveyor bearings after surveying demand |
| Zero and sign | Local drawing-frame positive X; CCW positive | Saved zero-angle offset and clockwise display preference |
| Angular precision | Independent display setting; never round stored geometry | DMS seconds precision and bearing format |
| Constraint | Explicit angle is hard; polar tracking is an acquisition aid | Multiple user-defined tracking increments |
| Ortho | Two perpendicular axes, default 0/90 degrees | Custom rotated drawing frame, not ambiguous “Ortho 45” |
| Normalization | Normalize direction for display; preserve arc sweep semantics | Multi-turn input only for commands that define it |

A full revolution is 360 degrees, 2π radians, or 400 grads. Thus 90deg, π/2 radians, and 100 grads describe the same direction. These are mathematical definitions, not claims about vendor expression parsers. Initial Caderact need not accept a literal π token. For later bearings, N 30° E means 60 degrees from positive X under the initial convention.

Angular display precision, angular solver tolerance, and angle-snap increment are three independent quantities. Changing a display setting must not rotate geometry; changing a tracking increment must not change tolerance. A typed complete Cartesian coordinate remains authoritative rather than being silently rotated by Ortho. Reflection reverses orientation, and arc sweep must be transformed accordingly.

## 6. Precision and tolerance specification

Displaying **0.00** means a formatted value rounded to two places. It does not imply the stored number is zero, that two points coincide, or that the object is accurate to 0.01. AutoCAD explicitly separates format/precision from internal precision. [Basics][AB].

Rhino documents absolute tolerance for approximate geometry operations and angular tolerance for construction/evaluation. Its guidance relates tolerance to feature size and model extent, rather than treating smaller tolerances as unconditionally better. [Rhino Units][RU].

**Do not generalize the 2× rule:** Rhino Join documentation describes a two-times-tolerance edge test for surfaces. That is not a documented universal curve-join or coincident-point rule. [Join](https://docs.mcneel.com/rhino/8/help/en-us/commands/join.htm).

**Relative tolerance evidence:** older official Rhino documentation describes it, but the reviewed Rhino 8 Units page does not expose the same setting. Do not build a claimed Rhino 8 global relative-tolerance behavior from an older page. Per-operation relative error and numerical conditioning remain necessary engineering concepts.

Recommended Caderact policy:

| Quantity | Purpose | Must not be reused as |
|---|---|---|
| Absolute modelling tolerance | User-scale approximation allowance in model units | Display rounding or mouse radius |
| Angular tolerance | Tangency/parallel classification allowance | Polar tracking increment |
| Intersection solver error | Convergence/residual criterion | Permission to silently merge objects |
| Join gap threshold | Explicit repair/connect policy | Universal intersection tolerance |
| Numerical comparison policy | Floating-point error handling, local scale aware | A user preference expressed in pixels |
| Snap aperture | Screen-space candidate search distance | Model geometry accuracy |
| Tessellation error | Display/export approximation bound | Stored analytic geometry |

Store geometry in Float64-equivalent numbers and keep origin/scale metadata. Keep GPU Float32 data separate. Perform local-origin calculations for very large coordinates; make the renderer camera-relative. This is a Caderact recommendation, not a claim that floating-point storage alone makes computations robust.

For predicates such as orientation and segment intersection, distinguish exactly collinear, near-collinear, overlapping, touching, and crossing cases. Use robust predicates or a validated geometry library where appropriate. For curved intersections, track parameter intervals and residuals. Apply tolerance to a stated geometric criterion, not every scalar subtraction.

Illustrative template proposal: 0.01 mm absolute and 0.1° angular tolerance for a general mm drafting template, subject to fixture-based validation. Do not make that suitable by assertion for surveying, microfabrication, and mechanical manufacture alike. Preserve the physical tolerance during unit conversion.

Reject non-finite inputs and zero-radius circles. Flag degenerate segments; do not silently remove imported small geometry. A finite precision model cannot promise unlimited zoom accuracy. If magnification exceeds useful numeric resolution, preserve the model and explain reduced interaction reliability.

## 7. Grid specification

Documented: Rhino's visible grid covers part of an infinite construction plane, with separate minor spacing, major interval, snap spacing, axes visibility, and viewport scope. [Rhino Grid][RG].

AutoCAD distinguishes GRIDUNIT from SNAPUNIT. Grid spacing can explicitly follow snap spacing when set to zero; adaptive density and subdivision affect display. Grid and snap align with the UCS origin, and the grid is not plotted. [AutoCAD grid][AG], [Grid settings, LT][AGS].

Recommended saved data: origin; 2D working-frame angle; base visible X/Y spacing; major interval; grid visibility; axes visibility; finite/infinite-display choice; snap X/Y spacing; independent snap enabled state. Separate per-view display overrides from document drafting defaults.

Recommended display algorithm: choose visible spacing from a stable sequence based on projected size, with hysteresis to avoid flicker while zooming. Decimal templates can use 1–2–5 steps; imperial templates may use fractional-inch/foot steps. Always label the currently displayed interval. Adaptive display must never secretly change snap spacing.

Colors and opacity are theme preferences with optional document presentation overrides. DPR changes line rasterization, not model spacing. Grid extents must not prohibit drawing outside the grid. A grid boundary is a display aid, not document geometry or a snap edge.

**Unresolved vendor detail:** a complete Rhino 8 adaptive-grid algorithm and identical X/Y snap-spacing UI were not established. Do not assume AutoCAD's settings have exact Rhino counterparts.

## 8. Object snap, grid snap, Ortho, and tracking specification

### 8.1 Documented behavior and its limits

Rhino supports running and one-shot snaps, a configurable snap radius, and temporary suspension. One-shot snaps override persistent choices; object snaps generally take precedence over grid/constraints, with documented exceptions. [Rhino snaps][RS], [Accurate Modeling](https://docs.mcneel.com/rhino/8/usersguide/en-us/html/ch-05_accuratemodeling.htm).

AutoCAD exposes running snaps, temporary overrides, markers/tooltips, and Tab cycling. Keyboard-coordinate precedence is configurable through OSNAPCOORD. [Precise points][ASP], [User preferences][APREF].

Neither reviewed help set fully specifies the internal spatial index, scoring weights, hysteresis, or complete tie-break order. The following mathematics and selection policy are proposed Caderact behavior, not reverse-engineered algorithms.

### 8.2 Snap definitions and proposed eligible geometry

| Snap | Mathematical target | Geometry / special case | Rhino / AutoCAD comparison |
|---|---|---|---|
| Endpoint | Boundary parameter of open curve/segment | Line, arc, ellipse arc, path segment, open spline, ray origin | End / Endpoint |
| Midpoint | Half segment length; spline midpoint defined by arc length in Caderact | Line, arc, eligible path segment/spline; no unique infinite-line midpoint | Mid / Midpoint; do not infer vendor spline parameterization |
| Center | Analytic centre | Circle, arc, ellipse; not arbitrary spline centroid | Cen / Center |
| Intersection | Shared point satisfying both finite curve domains | All supported curve pairs; overlap needs policy | Int / Intersection |
| Apparent intersection | Intersection of projected curves | Redundant for a strictly common 2D plane | Rhino option / distinct AutoCAD snap |
| Nearest | Closest eligible point to pointer projection | Supported curves; multiple local minima for splines | Near / Nearest |
| Perpendicular | Curve tangent orthogonal to vector from reference point | Line foot or roots on curved target | Perp / Perpendicular, requires reference |
| Tangent | Connecting vector collinear with curve tangent | Circle/arc/ellipse/spline solutions | Tan / Tangent, deferred solutions can be necessary |
| Quadrant | Four cardinal/extremal points under stated plane convention | Circle/ellipse and eligible arc subset | Quad / Quadrant |
| Point / Node | Stored point coordinate | Point entity; add definition points deliberately | Point / Node; AutoCAD includes annotation definition points |
| Extension | Natural curve continuation outside original domain | Initially line/arc; acquired endpoint | Rhino tracking/extension workflows / Extension |
| Parallel | Direction parallel to reference tangent/linear entity | Constraint on next segment, not a unique point | SmartTrack/constraints / Parallel |
| Vertex | Explicit path vertex | 2D path corners in Caderact | Rhino Vertex is principally mesh-oriented; avoid equating the names |
| Geometric centre | Area centroid of a closed region | Simple closed path with holes policy | Not equivalent to analytic Center |
| Knot | Curve location at knot parameter | Advanced spline editing only | Rhino Knot; defer in Caderact |

Vendor eligibility and limitations are described in [Rhino snaps][RS] and [AutoCAD Drafting Settings, Mac][AS]. In particular, projected intersections are distinct from true intersections, and AutoCAD documents special acquisition constraints for Parallel. Do not promote a manufacturer's long geometry list into a guarantee for Caderact's initial geometry kernel.

### 8.3 Proposed interaction contract

Every point request produces one **resolved point**, used identically by preview, click, typed feedback, and resulting geometry.

1. Complete numeric coordinates are authoritative.
2. Explicit distance/angle constraints are mandatory.
3. A one-shot snap narrows eligible candidates for one accepted point.
4. Running object snaps supply discrete and curve candidates.
5. Tracking supplies acquired references and constraint intersections.
6. Grid snap quantizes the remaining unconstrained pointer position.
7. Free cursor position is the fallback.

If a candidate violates a mandatory typed constraint, do not move it approximately to appear compliant. Find a valid constraint intersection, display the conflict, or reject the candidate.

Prototype acquisition radius: 10 CSS pixels, user adjustable; prototype release radius: 14 CSS pixels. These are usability hypotheses, not vendor defaults. Rank eligible candidates by distance, then stable category/ID tie-breaks. Prefer discrete endpoints/intersections over continuous Nearest within a small tie band. Tab cycles a stable candidate list without jumping geometry.

Use distinct simple markers plus text labels: endpoint square, midpoint triangle, center circle, intersection X, nearest diamond, perpendicular right-angle mark, tangent circle/line, quadrant diamond with label, point dot/ring. These are proposed original symbols, not copied UI assets. Use text as well as color. Show the resolved marker at the actual drawing point; the native mouse cursor need not physically move there.

Running selections persist when the master Snap toggle is disabled. One-shot state ends after a successful point or cancellation, not merely on hover. Hidden objects are excluded initially; locked visible references remain snappable by explicit policy. Selection filters must not silently become snap filters.

### 8.4 Ortho, angle snap, and tracking

Rhino Ortho permits a configurable angular increment, defaults to 90°, and supports a held Shift override. SmartTrack can retain acquired points and construct temporary references for the command. [Ortho][RO], [SmartTrack][RT].

AutoCAD distinguishes Polar Tracking, Object Snap Tracking, and PolarSnap distance increments. Its documented presets/settings distinguish direction relative to the UCS from direction relative to the previous segment. [Drafting Settings][AS].

Recommendation: **Ortho** means horizontal/vertical in the active 2D frame. **Angle Snap** offers an explicit increment such as 45°. **Track** acquires geometry references. When Ortho is enabled, show angle snapping as suspended and restore its previous setting when Ortho ends. Coordinate input stays authoritative. Do not call all three “Snap” internally.

Construction guides are optional saved objects; tracking lines are ephemeral. Neither belongs in the completed Line array. In strictly 2D work, Planar adds no additional point constraint; do not invent a new elevation behavior to justify the existing toggle.

## 9. Coordinate-input specification

Rhino supports construction-plane/world input, relative r or @ forms, and polar coordinates. AutoCAD command-line Cartesian input uses comma-separated components; dynamic input uses # for explicit absolute coordinates and @ for relative input. [Rhino coordinates][RI], [AutoCAD Cartesian][AI].

Proposed grammar:

| Entry | Meaning |
|---|---|
| 100,200 | Absolute point in active 2D frame |
| @100,200 | Offset from command's current reference point |
| @100<45 | Length 100 at 45° from reference point |
| 100<45 | Polar position relative to frame origin |
| 100mm,2m | Independently unit-aware Cartesian components |
| 100 | Distance along current resolved direction when the prompt expects distance |
| <45 | Lock direction for a subsequent distance/pick |
| #100,200 | Optional explicit absolute synonym, consistent in every input surface |

The current prompt determines whether a scalar is a distance, radius, scale factor, angle, count, or option. Never apply length units to a scale factor or vertex count. Relative coordinates must show their reference point; initially use the current command's last accepted point, not a hidden point from an unrelated previous command.

Direct distance entry: pick A, point in a direction, type a length, Enter; resolve B from A and the chosen direction. Ortho/polar can establish that direction. A full typed point bypasses mouse-derived quantization. Dynamic input is another presentation of the same parser and resolver, not a second calculation path.

Space has a real ambiguity with fractional input and text. Preserve the user's existing Space-to-launch-command behavior, but treat spaces inside value/text editing as text. Enter confirms typed coordinates. Do not make “1 1/2” launch or finish a tool after “1”.

Acceptance fixtures: negative coordinates, mixed suffixes, fractional inches, decimal-point locale, zero distance, invalid suffix, incomplete pair, impossible tangent, relative input before a reference, and pointer leaving the canvas while a value is being edited.

## 10. Command-system specification

Documented: Rhino accepts options by clickable label or abbreviated option input; Enter/Space/right-click accept input and Escape has several context-dependent clearing/cancel actions. AutoCAD offers autocomplete, option keywords, command history and transparent commands prefixed by an apostrophe. [Rhino modifiers][RK], [AutoCAD command line][AK].

Caderact should use explicit states: idle, command search, object selection, point/value request, option entry, and command completion. Each state owns its permitted keys.

| Context | Enter | Space | Escape |
|---|---|---|---|
| Command search with valid suggestion | Execute highlighted match | Execute highlighted match | Clear search and close suggestions |
| Point/value text | Parse and accept valid input | Literal input where meaningful | Clear edit first; expose next cancellation action |
| Active Line, empty input | Accept completed session; discard unfinished point | Existing navigation behavior | Cancel current session and remove only its created objects |
| Idle, no field focus | Repeat last repeatable tool, if enabled | Existing navigation behavior | Clear selection |
| Text object/editor or other UI input | Field-specific | Literal space | Field-specific dismiss |

The Line session rollback above preserves the user's established Caderact requirement; it is not asserted to be AutoCAD's LINE cancellation policy. Commands should own transactions so undo/redo, cancel, and accepted results are unambiguous. Substep Undo removes the last segment without ending the tool; accepting the command creates one document undo record.

Clicking a suggestion must call the same execution path as Enter. A consumed key cannot bubble into a second command action. Handle IME composition, key repeat, text fields, and browser shortcuts explicitly. Keep aliases configurable; examples in the matrix are proposed Caderact aliases, not claims about factory profiles.

Navigation can suspend a point request and resume it afterward. Defer arbitrary nested geometry commands. Right-click defaults to a context menu; optional short-click acceptance can be a user preference. Show command history and errors without replacing input unexpectedly.

## 11. Geometry and tool comparison

The companion matrix is the command inventory. The most consequential geometry decisions are:

- A connected Line session produces several objects. A path/polyline is one ordered object with stable segment identity.
- A group references independent objects. A block instance references a reusable definition and transform. Neither is a polyline.
- A closed curve is not automatically a filled region. A region adds interior/holes semantics; a hatch adds a pattern referencing boundaries.
- A circle/arc has an analytic centre/radius. An ellipse under nonuniform scaling remains an ellipse; arbitrary path flattening is not a lossless substitute.
- Interpolation points are not control vertices. Rebuild changes representation and may change shape; require deviation reporting.
- Infinite lines and rays need domain-aware math. Rendering them as long finite lines does not define their geometry.

Documented examples: Rhino Rectangle creates a closed polyline; Rhino Curve/InterpCrv distinguish control and interpolation input. AutoCAD SPLINE exposes Fit/CV methods and fit tolerance. [Rectangle](https://docs.mcneel.com/rhino/8/help/en-us/commands/rectangle.htm), [Rhino Curve][RC], [AutoCAD SPLINE][AC].

Recommendation: start with point, line, arc/circle, and line/arc path entities. Add ellipse and rational spline representation when editing/evaluation/export support exists. Store degree, knots, weights, control points, domain, and periodicity explicitly for splines. Do not infer that an arbitrary closed spline is smooth across its seam.

Each create tool should specify required inputs, preview, commit condition, substep undo, invalid/degenerate cases, and resulting entity type. Geometry measurements use model units; counts and ratios are dimensionless. Circle/arc point picking must disambiguate tangent solutions and short/long arc branches.

## 12. Selection and modify comparison

Rhino documents Shift-add, Ctrl/Cmd-remove, left-to-right window, right-to-left crossing, overlap selection menus, and pre/postselection. AutoCAD SELECT offers Window, Crossing, Fence, polygon options, Previous, Add/Remove, and command-specific selection contexts. Their selection modifiers are not identical. [Rhino selection][RSEL], [AutoCAD SELECT, LT Mac][ASEL].

Recommendation: select by object identity with a separate subobject set. Define window as fully enclosed, crossing as enclosed or intersecting, and fence as intersecting its path. A bounding box can accelerate selection but cannot be the final test for curves. Keep previous selection as surviving IDs, not stale array indices. Expose filter state and overlap choices visibly.

Rhino's selection filter can restrict captures; documentation describes automatic filter disable after failed picks. Caderact should instead explain “No eligible objects under this filter” and provide a clear reset action. [SelectionFilter][RF].

Modify dependencies:

| Operation family | Inputs / behavior | Required foundation |
|---|---|---|
| Move/Copy | Selection, base point, displacement; preview before acceptance | IDs, transforms, transaction |
| Rotate/Mirror/Scale | Pivot/axis/reference; angle/ratio or reference length | Consistent 2D transforms and type conversion policy |
| Trim/Extend | Cutter/boundary, target portion/end | Reliable intersections, curve domains, hit testing |
| Split/Break | Split locations; keep all pieces or remove interval | Stable topology remapping |
| Join/Explode | Compatible chain / decomposition | Ordering, closure, attribute inheritance |
| Offset/Fillet/Chamfer | Side/radius/distance/branch | Intersections and curve reconstruction |
| Stretch | Selected vertices/region, displacement | Subobject editing and per-type behavior |
| Rebuild/Match/Simplify | Deviation/continuity goals | Curve evaluation and error estimation |

Documented difference: AutoCAD Quick Trim can delete an object that cannot be trimmed; Rhino Trim explicitly chooses cutting objects and removable portions. Both document Shift to extend during trimming. Caderact should preview the removed interval and make whole-object deletion a separate explicit outcome. [AutoCAD Trim][ATRIM], [Rhino Trim](https://docs.mcneel.com/rhino/8/help/en-us/commands/trim.htm).

AutoCAD Stretch uses crossing selection to identify the points affected; a block can move by its insertion point rather than deforming. Lengthen provides Delta, Percentage, Total, and Dynamic methods. [Stretch/Lengthen][AST].

Rhino Offset exposes corner/cap/tolerance choices and notes difficult results for large offsets or irregular curves. Rebuild previews maximum deviation; Match concerns continuity, not property copying. [Offset](https://docs.mcneel.com/rhino/8/help/en-us/commands/offset.htm), [Rebuild](https://docs.mcneel.com/rhino/8/help/en-us/commands/rebuild.htm), [Match](https://docs.mcneel.com/rhino/8/help/en-us/commands/match.htm).

Caderact must retain original geometry on failure, report partial results, and make attribute/ID replacement policies explicit. Joining two objects should not silently erase their metadata conflict.

## 13. Layers and properties specification

Rhino supports nested layers; AutoCAD uses layers and layer filters rather than an equivalent Rhino-style parent/child layer tree. Both support layer-driven appearance and object overrides. [Rhino Layer][RLY], [AutoCAD Layer][ALY].

Recommended layer fields: stable ID, name, parent ID, visible, locked, color, linetype ID, print lineweight, opacity, printable. Effective visibility/lock follows ancestors. An object's assigned layer does not change when a layer is renamed or reordered.

Create/rename/current-layer changes are distinct actions. Deleting a nonempty layer must offer a concrete reassignment or explicitly delete its objects. Prevent deleting the last required layer or leaving “current layer” dangling. Isolate is temporary visibility state with a restore snapshot. Saved layer states use IDs and define behavior for layers added afterward. AutoCAD documents restoration/export and viewport overrides for layer states. [Layer states][ALS].

Properties panel:

| Property | Recommended editing behavior |
|---|---|
| Type and ID | Read-only identity; explicit conversion commands |
| Coordinates | Typed quantity editor, transaction, shared validation |
| Radius/length/angle | Editable only where a deterministic reconstruction rule exists |
| Area/perimeter | Derived read-only measurements unless a scale command is invoked |
| Layer/style | ByLayer by default; show effective and overridden values |
| Linetype | Pattern definition and physical/model scale |
| Lineweight | Plot stroke property, distinct from path geometric width |
| Transparency | Defined opacity convention and inheritance |
| Name/metadata | Optional display name; typed or string attributes; preserve import provenance |
| Multiple selection | Common properties; mixed values visibly marked |

AutoCAD PROPERTIES shows shared properties for multi-selection and creation defaults when nothing is selected. Adopt that clarity. [Properties][APR]. Rhino's panel delegates to object-specific property pages. [Rhino Properties][RPR].

Groups are editable collections, not shared definitions. Blocks need definition IDs, base point, instance transform, and per-instance attributes. Attribute inheritance must remain predictable through nested instances. Do not implement BIM object classification inside these basic metadata fields yet.

## 14. Annotation, dimensions, hatch, and fill

### 14.1 Annotation

Rhino Text/Leader and annotation styles provide text and callout formatting. AutoCAD distinguishes TEXT, MTEXT, LEADER/MLEADER, table objects, and styles. A native Rhino equivalent to the full AutoCAD table/data-link system was not established; avoid claiming parity. [Rhino Text](https://docs.mcneel.com/rhino/8/help/en-us/commands/text.htm), [Rhino Leader](https://docs.mcneel.com/rhino/8/help/en-us/commands/leader.htm), [AutoCAD Table][ATABLE].

Recommendation: one text object with single-line and multiline editing modes; UTF-8 content; font reference/fallback; alignment; rotation; explicit model/paper height. A leader references content with one or more branches. Document notes are not positioned drawing text. Tables need a cell model, not a group of line/text objects. Defer formulas/data links.

Center marks/lines should become derived annotation objects with reference IDs. Their line pattern and extension length are style properties. Avoid baking them into anonymous lines.

### 14.2 Dimensions

| Kind | Measurement | Minimum references |
|---|---|---|
| Linear | Projection along horizontal/vertical/chosen axis | Two points and measurement axis |
| Aligned | Euclidean distance | Two points |
| Angular | Chosen angular sector | Two directions or vertex + two points |
| Radius/Diameter | Analytic circle/arc size | Object reference |
| Arc length | Length on selected arc interval | Arc and interval |
| Ordinate | X or Y from datum | Point, datum frame, axis |
| Baseline | Repeated measurements from first datum | Base dimension plus new references |
| Continued | Chain from prior endpoint | Prior dimension plus next reference |

AutoCAD DIM can infer types and has persistent baseline/continue modes; DIMASSOC distinguishes exploded, non-associative, and associative dimensions. Rhino annotation History provides updates but has its own rules. [AutoCAD DIM][AD], [DIMASSOC][ADA], [Rhino History][RHIS].

Recommendation: store references, measured quantity, label placement, style ID, and explicit overrides. Computed text must remain separate from user text. Editing a dimension label must not resize geometry unless a future explicitly named driving-dimension feature exists. An overridden measurement label must be visibly identifiable.

Style settings: units/alternate units, decimals/fractions, rounding increment, zero suppression, prefix/suffix, arrow/text size, fit rules, baseline spacing, and tolerance presentation. Manufacturing tolerance labels do not alter the modelling tolerance. Rhino exposes these style/override concepts; model-space scale multiplies annotation component sizes. [Annotation properties][RAN].

Associativity needs stable reference remapping after Trim, Split, Join, Explode, and block edits. If a reference is lost, mark the dimension detached; never silently attach it to the nearest unrelated point. Add baseline/continued and arc-length dimensions after basic references and styles work.

### 14.3 Hatch/fill

Rhino Hatch supports pattern and rotation/scale controls and History-related behavior; AutoCAD supports associative boundaries, island policies, gap tolerance, patterns, solid and gradient fill. [Rhino Hatch][RH], [AutoCAD -HATCH][AH].

Recommendation: first fill explicit closed paths; add click-inside boundary detection after a validated planar arrangement system. A region carries outer loops/holes; a hatch references that region or boundary set. Save pattern ID/definition, origin, angle, spacing scale, foreground/background, and associativity.

Handle islands with an explicit even-odd or winding rule. Report gaps instead of silently increasing tolerance. A user-approved gap closure is an operation with a visible tolerance, separate from intersection accuracy. Cap rendering density without modifying pattern parameters. Hatch origin and scale are independent. Do not enable snapping to every hatch stroke by default.

AutoCAD 2026 HATCH includes direct boundary drawing modes, so it is not limited to clicking a pre-existing enclosed area. [HATCH][AHNEW].

## 15. Measurement tools

Documented: Rhino provides dedicated measurement commands; AutoCAD MEASUREGEOM consolidates distance, radius/diameter, angle, and area with dynamic feedback and add/subtract workflows. [Rhino measurement][RME], [AutoCAD MEASUREGEOM][AME].

Recommendation: Measure is a read-only tool family. Return raw value, formatted value, unit, selected object/reference, and relevant error estimate. Distance can show ΔX/ΔY and running total. Length sums selected curves. Area subtracts holes; perimeter explicitly states whether hole boundaries are included. A radius request on a general spline must report local curvature radius or “not a circle,” never imply a constant radius.

For open paths, do not silently report an enclosed area: offer explicit temporary closure and show its closing edge. Self-intersections require a selected fill rule. Use model geometry, never pixel distances or rounded text.

Divide-by-count and place-at-interval are creation tools, not distance queries. Specify whether to include endpoints, how closed seams are treated, what to do with a short remainder, and whether output is point entities or instances. Rhino Divide provides count/length workflows. [Divide](https://docs.mcneel.com/rhino/8/help/en-us/commands/divide.htm).

## 16. Views and templates

Rhino Zoom includes window/extents/selected/previous-style workflows and NamedView stores reusable views. [Zoom](https://docs.mcneel.com/rhino/8/help/en-us/commands/zoom.htm), [NamedView](https://docs.mcneel.com/rhino/8/help/en-us/commands/namedview.htm).

Recommendation: preserve current mouse navigation preferences; add named commands Pan, ZoomWindow, ZoomExtents, ZoomSelected, PreviousView. Extents excludes infinite guides and transient previews; define whether hidden objects count. Empty documents need a sensible default view, not division by zero. Keep navigation history separate from geometry undo.

Rhino templates are 3DM files that can contain geometry, grid, viewports, layers, units, and tolerances. AutoCAD drawing templates preserve drawing settings and style definitions. [Rhino New][RN], [AutoCAD templates][AN].

| Scope | Caderact recommendation |
|---|---|
| Document | Geometry, IDs, units, tolerances, layers, blocks, styles, saved views, metadata, layout/print settings |
| Per-view document state | Camera, work frame, grid visibility/density preferences, layer overrides |
| Application preference | Theme, cursor appearance, aliases/keymap, mouse bindings, snap aperture, tooltip delay, accessibility |
| Session | Current command, preview, hover candidates, one-shot snaps, navigation gesture, temporary selection |
| Template | Explicit copy of intended document defaults; optional starter geometry clearly identified |

Global defaults seed new documents. They must not silently reinterpret existing documents. Printing needs a separate model-to-paper scale and sheet unit; screen zoom is never print scale.

## 17. 2D interoperability

| Format | Strong mapping | Principal losses / decisions |
|---|---|---|
| DXF | Analytic primitives, line/arc paths, layers, blocks, text, dimensions, hatch entities in supported versions | Version-dependent entities; unitless or wrong metadata; fonts; object-coordinate systems; proxy objects; associativity |
| DWG | Rich native AutoCAD drafting database | SDK/service/version strategy; complex/proprietary object types; do not promise parity from a minimal writer |
| 3DM | Curves, units/tolerance, layer hierarchy, instances, attributes | Caderact must understand imported curve representations and unsupported object data |
| SVG | Paths, shapes, fills, groups, text, stroke styling | No standard CAD dimension/block/layer semantics; user-unit/viewBox conversion; font/layout differences |
| PDF | Published sheet appearance, vector paths/fills/text | Object semantics and numerical fidelity can be lost; scans are images; dimensions/hatches can become disconnected primitives |

Rhino documents DWG/DXF translation of layer names/colors, blocks, unit metadata, and property inheritance; dynamic block variants can become static definitions. [Rhino exchange][RX]. McNeel's openNURBS guide describes writing geometry plus units/tolerances, layers and viewports to 3DM. [openNURBS](https://developer.rhino3d.com/guides/opennurbs/getting-started/).

SVG has nested coordinate systems and viewBox transforms; its user units cannot be assumed equal to Caderact mm. [W3C SVG coordinates][SVG]. Rhino exposes choices for importing filled SVG paths as curves, hatches, or trimmed planes. [Rhino SVG][RSVG].

Autodesk explicitly warns that PDF conversion loses information and precision. Imported dimensions, patterned hatches, leaders, and tables can become separate objects. Treat that as an exchange limitation, not a universal claim that the PDF specification uses one fixed numeric representation. [PDF import][APDF].

**Recommended first interchange:** an explicitly documented ASCII DXF subset after native save/load. Support POINT, LINE, CIRCLE, ARC, basic LWPOLYLINE, layers, and explicit units first. Add blocks/text next, then spline/dimension/hatch only with round-trip fixtures. Evaluate a modern DXF version; do not select R12 merely because it is simpler and then claim rich modern-entity support.

Import report: source version; assumed/detected unit; conversion factor; original coordinates; unsupported entity counts; font replacements; approximations; lost associations; resulting extents. Do not silently flatten unknown geometry or change the source unit to fit the screen.

Tests must include 1 inch versus 25.4 mm, unitless input, nested block transforms, clockwise arcs, path bulges, holes, off-origin objects, unsupported text fonts, and documents with no geometry. Compare dimensions and topology, not just screenshots.

## 18. Rhino versus AutoCAD comparison matrix

| Concern | Rhino 8 | AutoCAD 2026 | Caderact direction |
|---|---|---|---|
| Continuous segments | Lines, separate objects | LINE, separate objects | Preserve Line behavior |
| Joined path | Polyline / mixed polycurve distinctions | PLINE line/arc object | Explicit segment-aware path |
| Freeform | Curve versus InterpCrv | SPLINE CV versus Fit | Distinct creation methods |
| Units | Model/layout units; rescale question | Display format plus insertion metadata | Separate display/convert/reinterpret |
| Grid | CPlane and viewport settings | UCS grid, adaptive display, separate snap | Stable work frame and separate data |
| Snapping | Persistent/one-shot + modeling-aid options | Running/override + Tab cycling | One point resolver |
| Tracking | SmartTrack temporary references | Object Snap Tracking / Polar Tracking | Explicit reference acquisition |
| Selection | Shift-add, Ctrl-remove; menu for overlaps | Add/remove and selection prompts | Documented consistent browser keymap |
| Dimensions | Annotation History | DIMASSOC association modes | Reference graph and detached state |
| Organization | Nested layers, groups, instances | Layers, groups, blocks, layer states | IDs and explicit inheritance |
| Curve editing | Rich curve-specific tools | Entity/grip/PEDIT/SPLINEDIT workflow | Preserve type and report conversions |
| Exchange | Configurable export schemes | Rich drawing entities | Explicit supported subset |

Evidence: [RL], [RP], [RC], [RU], [RG], [RT], [RSEL], [RHIS], [AL], [AP], [AC], [AU], [AINS], [AS], [ASEL], [ADA], [RX]. These links refer to the detailed official findings above; the last column is recommendation.

## 19. Adopt / Adapt / Avoid / New

| Subsystem | ADOPT | ADAPT | AVOID | NEW opportunity |
|---|---|---|---|---|
| Document | Units/styles saved with design | Template defaults | Global settings changing old files | Explain settings ownership |
| Geometry | Analytic entities and structured paths | Shared curve interface | Renderer vertices as source data | Type/approximation inspector |
| Units | Explicit suffix conversion | Separate display from physical conversion | Ambiguous “change units” | Before/after physical-size preview |
| Precision | Operation tolerances | Template presets | One epsilon for every purpose | Failure messages with residual/gap |
| Grid | Independent snap spacing | Adaptive display | Zoom altering snap silently | Visible grid/snap interval labels |
| Object snaps | One-shot and running modes | Candidate ranking/cycling | All snaps enabled by default | Show exact resolved point/reason |
| Tracking | Acquired references | Small stable reference list | Surprise long-lived inferred anchors | Inspect/clear active references |
| Commands | Typed prompts, aliases, autocomplete | Space and browser keys | Context-free global shortcuts | Visible state-specific key hints |
| Selection | Window/crossing and filters | One coherent modifier convention | Invisible filter changes | Explain why object is ineligible |
| Modify | Preview and substep undo | Type-aware operations | Silent destructive failure | Preview topology/ID changes |
| Layers | Inheritance and instances | Hierarchy export mappings | Index-based identities | Effective-property explanation |
| Annotation | Styles and associations | Paper-size text | Overridden text pretending to be measurement | Detached-reference repair |
| Measurement | Read-only geometric queries | Dynamic previews | Measuring pixels | Copy raw/formatted value separately |
| Interchange | Standard entity mapping | Explicit loss policies | “Supports DXF” without version/subset | Machine-readable import report |
| Navigation | Extents/selected/previous | Existing mouse preferences | Navigation changing geometry | Independent view history |

These are conceptual workflow recommendations. No proprietary icons, assets, branding, code, or exact visual layouts are proposed for copying.

## 20. Dependency graph

~~~mermaid
flowchart TD
  D[Document IDs and transactions] --> U[Unit and tolerance contract]
  D --> G[Geometry entities and evaluation]
  U --> G
  U --> I[Typed quantity and point input]
  G --> C[Camera and coordinate conversion]
  C --> V[Visible grid]
  C --> S[Hit testing and spatial queries]
  U --> GS[Independent grid snap]
  C --> GS
  G --> S
  S --> O[Object snaps]
  S --> SEL[Selection]
  I --> P[Shared point resolver]
  GS --> P
  O --> P
  P --> T[Angle constraints and tracking]
  D --> L[Layers and properties]
  SEL --> M[Transforms and core modify]
  G --> X[Robust intersections and topology]
  X --> M
  X --> H[Boundaries regions and hatches]
  M --> A[Stable reference remapping]
  A --> DIM[Associative dimensions]
  L --> DIM
  U --> DIM
  D --> SAVE[Native persistence]
  SAVE --> EX[Versioned interchange]
  G --> EX
  L --> EX
~~~

This is a dependency graph, not a requirement to finish every node before drawing a line. A minimal Line and test fixtures should exercise the foundation early. Visible grid is not a prerequisite for object snaps or geometry; it shares coordinate foundations.

## 21. Priorities and implementation roadmap

| Priority | Meaning | Representative features |
|---|---|---|
| P0 | Core architecture | IDs, transactions, units, tolerance policy, geometry contracts, camera/input boundary, native persistence |
| P1 | Essential 2D CAD | Line/polyline, rectangle/circle/arc, selection, move/copy/rotate/scale/mirror, basic snaps, grid, trim/extend, layers, basic measurement, DXF subset |
| P2 | Professional drafting | Fillet/chamfer/offset, robust joins/breaks, text/leaders, associative dimensions/styles, hatch/fill, blocks, print layouts, full selection aids |
| P3 | Advanced 2D | Spline editing/rebuild/match, complex boundaries, associative arrays, rich tables, advanced snap/tracking, richer interchange |
| P4 | Later 2D expansion | Broad specialist unit menus, complex formula/data-link workflows, advanced spline inspection and comprehensive legacy compatibility |

P4 is deferral of 2D work, not a 3D design proposal. Actual priority depends on whether the first market is architectural drafting, mechanical design, or illustration.

| Milestone | Deliverable | Exit evidence |
|---|---|---|
| 1 — Document contract | IDs, transactions, units/tolerance, native format versioning | Save/load preserves IDs and numeric geometry; undo unit conversion exactly |
| 2 — Coordinate foundation | Camera, work frame, point parser, independent grid/snap | Typed coordinates match clicks across resize/DPR/zoom |
| 3 — Minimal geometry loop | Line, path, circle, arc with previews | Enter accepts; Escape rolls back only active transaction; degenerate cases rejected |
| 4 — Queries and selection | Bounds/spatial queries, click/window/crossing, basic snaps | Correct overlapping candidates and exact resolved preview/click points |
| 5 — Editing | Transforms; intersections; trim/extend/split/join | No unwanted deletion; tangent/overlap fixtures; stable ID mapping |
| 6 — Drawing organization | Layers/properties, groups, native templates; first DXF | Appearance inheritance and physical-size round trips |
| 7 — Precision drafting | Perp/tangent, angle tracking, offset/fillet/chamfer | Multiple-solution choice and clear failures |
| 8 — Documentation | Text, leaders, dimensions, annotation styles | Geometry edits update labels; broken references are visible |
| 9 — Sheets and fills | Regions, hatches, layouts, print/PDF output | Holes and paper scale correct; font substitutions reported |
| 10 — Advanced 2D | Spline tooling, arrays, richer exchange | Deviation reports and declared format fidelity |

Do not build every running snap before there are corresponding geometry types. Build endpoint/midpoint with lines, center/quadrant with circles, perpendicular/tangent with appropriate solvers, and only then richer tracking.

## 22. Open architectural decisions and validation register

Resolve before substantial implementation:

1. **Storage scale:** document-unit Float64 versus canonical metres. Proposed starting choice: document-unit storage with exact unit metadata and atomic conversion. Confirm the expected coordinate/feature range before finalizing.
2. **First-user discipline:** architectural plans versus precision mechanical sketches; this changes templates and annotation priorities.
3. **Path semantics:** line/arc path entity plus generic polycurve later, or one general segment collection from the start?
4. **Tolerance contract:** exact threshold meanings, supported numerical range, and operation-specific errors.
5. **Reference identity:** how Split/Trim/Join remap dimension and hatch references.
6. **Cancellation:** preserve the existing whole-session Line rollback; define equivalent policies for Copy/Trim and other repeated tools.
7. **Input grammar:** localized decimal handling, mixed fractions, Space behavior, option-versus-unit ambiguity, IME.
8. **Snapping:** geometric midpoint definition, quadrant orientation, coincident candidates, overlap intervals, locked/hidden policy.
9. **Annotation scale:** model-space versus paper-space ownership and effective printed height.
10. **Interchange:** versioned DXF subset, unknown entity strategy, custom units, fonts, and non-planar imports.
11. **Layers:** hierarchy inheritance and flattening rules for exchange; explicit treatment of group and block identity.
12. **Geometry library:** supported operations, license, browser performance, and robustness tests; not selected in this research.

Vendor behavior requiring hands-on confirmation before compatibility promises:

| Evidence gap | Required fixture |
|---|---|
| AutoCAD raw prompt suffix parsing | Try every requested metric/imperial token with dynamic input on/off and several drawing formats |
| Unit conversion command variants | Compare UNITS, INSUNITS, and installed -DWGUNITS behavior on 1000-unit geometry |
| Exact snap ranking and midpoint definitions | Coincident discrete snaps; symmetric curves; nonuniform spline parameterization |
| Running versus deferred tangent | First-point tangent, two-curve tangent, inside-circle impossible tangent |
| Rhino curve joining threshold | End gaps below/at/above tolerance; do not reuse the surface 2× description |
| Cancellation of multi-step vendor tools | Accept several segments/results then Escape; record objects and undo history |
| Rhino equivalent for full table/multileader workflows | Verify native commands and entity structure; exclude plug-ins from parity claims |
| Native layer/property and linetype detail | Mixed selection, lock/hide, nested instances, print settings across exchange |
| Font/dimension/hatch fidelity | Open exported fixtures in both target products and compare numeric and semantic results |

A future repository review should separately verify that renderer fallback, device loss, high-DPI output, and model/render separation satisfy their contracts. This research did not inspect or certify the previous WebGPU implementation.

## Sources and evidence policy

Inline references identify official pages. Rhino command pages linked in the matrix provide additional per-tool references. Source limitations are stated where relevant. Older Rhino relative-tolerance documentation was used only to identify a version ambiguity, not to establish current behavior.

Recommendations, mathematical definitions, milestone ordering, proposed aliases, and acceptance fixtures are Caderact design work. They are not quoted product specifications. The next implementation specification should turn the proposed defaults and unresolved questions into explicit, testable decisions.

[RU]: https://docs.mcneel.com/rhino/8/help/en-us/documentproperties/units.htm
[RL]: https://docs.mcneel.com/rhino/8/help/en-us/commands/line.htm
[RP]: https://docs.mcneel.com/rhino/8/help/en-us/commands/polyline.htm
[RC]: https://docs.mcneel.com/rhino/8/help/en-us/commands/curve.htm
[RG]: https://docs.mcneel.com/rhino/8/help/en-us/documentproperties/grid.htm
[RS]: https://docs.mcneel.com/rhino/8/help/en-us/user_interface/object_snaps.htm
[RA]: https://docs.mcneel.com/rhino/8/help/en-us/options/modeling_aids.htm
[RT]: https://docs.mcneel.com/rhino/8/help/en-us/commands/smarttrack.htm
[RO]: https://docs.mcneel.com/rhino/8/help/en-us/commands/ortho.htm
[RI]: https://docs.mcneel.com/rhino/8/help/en-us/user_interface/accurate_modeling.htm
[RK]: https://docs.mcneel.com/rhino/8/help/en-us/user_interface/keyboard%20modifiers.htm
[RSEL]: https://docs.mcneel.com/rhino/8/help/en-us/commands/select.htm
[RF]: https://docs.mcneel.com/rhino/8/help/en-us/commands/selectionfilter.htm
[RLY]: https://docs.mcneel.com/rhino/8/help/en-us/commands/layer.htm
[RPR]: https://docs.mcneel.com/rhino/8/help/en-us/commands/properties.htm
[RD]: https://docs.mcneel.com/rhino/8/help/en-us/commands/dim.htm
[RAN]: https://docs.mcneel.com/rhino/8/help/en-us/documentproperties/annotation.htm
[RH]: https://docs.mcneel.com/rhino/8/help/en-us/commands/hatch.htm
[RHIS]: https://docs.mcneel.com/rhino/8/help/en-us/commands/history.htm
[RN]: https://docs.mcneel.com/rhino/8/help/en-us/commands/new.htm
[RX]: https://docs.mcneel.com/rhino/8/help/en-us/fileio/autocad_dwg_dxf_import_export.htm
[RSVG]: https://docs.mcneel.com/rhino/8/help/en-us/fileio/scalable%20vector%20graphics_svg_import_export.htm
[RME]: https://docs.mcneel.com/rhino/8/help/en-us/seealso/sak_measure.htm
[AU]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-75419F91-18B8-47EE-9272-3196ACC95977.htm
[AINS]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8.htm
[AB]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-MAC-GettingStarted/files/GUID-79998D4E-D8C2-4A97-AE68-044DC03F0D63.htm
[AL]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-MAC-Core/files/GUID-9421191D-F461-41BE-AC14-5D4FFB07178D.htm
[AP]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-11883C70-6435-4F80-8FB4-F6E933B8FD94.htm
[AC]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-5E7D51E2-1595-4E0C-85F8-2D7CBD166A08.htm
[AG]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-FEA6BC6E-D81E-4AD2-BD4C-70078C57709A.htm
[AGS]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT/files/GUID-66D637C9-6C47-420C-ADD1-83B64C73217A.htm
[AS]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-MAC-Core/files/GUID-06D81B23-B171-4F33-920B-4609E22DD9E5.htm
[ASP]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-392167BC-8032-44D9-B4A9-DF4AC00DF5C4.htm
[APREF]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT/files/GUID-2E780292-7D34-4A34-8CCC-82363D4F9092.htm
[AI]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-F64F8008-E1C0-49CC-A268-A6B8C6E9B566.htm
[AK]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-MAC/files/GUID-3C87A58F-1980-451D-A9D3-32327FA63D81.htm
[ASEL]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-MAC/files/GUID-0DD5DA73-9DC5-4424-8FED-7BBE3BE52A4D.htm
[ALY]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-9123091A-2DCB-4DE8-983C-F7CA38FA67BE.htm
[ALS]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-CD3DA238-70EE-4931-815C-34BED7227BE2.htm
[APR]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-DC3674C5-A4C7-4CF6-9148-9B124DF29B78.htm
[AD]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-45C1A271-9650-4927-858F-B3BDB19B3E6C.htm
[ADA]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-D77085A3-6E4C-4C18-AD70-21F54ED72492.htm
[AH]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-410ECEBF-7CC2-4000-A45E-18F1F6BEE423.htm
[AHNEW]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-27C104F2-B687-4025-B50B-A58E37329832.htm
[AME]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-5D5B0EE1-DD90-47AE-8A55-642FBFF5E4E4.htm
[AN]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-BAEB2254-FC45-48FD-96B1-A955FCA1C688.htm
[APDF]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-MAC-Core/files/GUID-76FD0B6E-CE15-4EAC-B8EA-D83E4E1233EF.htm
[ATRIM]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-B1A185EF-07C6-4C53-A76F-05ADE11F5C32.htm
[AST]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-19FDC9E4-049E-40BA-AB6D-58A4C2557570.htm
[AARRAY]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-E23F6125-E5E9-4645-9615-23717902C33B.htm
[ATABLE]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-B958B73F-E812-41DC-8AA3-074A1E125BF4.htm
[AINDEX]: https://help.autodesk.com/view/ACD/2026/ENU/?page=commands&q=*
[SVG]: https://www.w3.org/TR/SVG2/coords.html
[AANGLE]: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-MAC/files/GUID-D396FBFE-6171-4A89-9E68-6CB082EBE0E1.htm

