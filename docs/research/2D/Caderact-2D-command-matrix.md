# Caderact 2D capability and command matrix

Companion to the [research and specification](Caderact-2D-foundation-research.md). Research date: 5 September 2026.

## How to interpret the matrix

Vendor columns name documented commands or explicitly qualified workflow counterparts; they do not promise identical geometry or options. **All purpose, options, aliases, priorities, and implementation notes describe proposed Caderact behavior**, unless explicitly identified as a vendor distinction. An em dash means no proposed short alias or no exact equivalent established, not necessarily that the vendor lacks the capability. Aliases below are suggestions, not copied vendor defaults; matching is case-insensitive, exact aliases win over prefixes, and collisions must be rejected.

Priorities: P0 architecture; P1 essential 2D; P2 professional drafting; P3 advanced 2D; P4 after the initial 3D phase. This document does not design that 3D phase. “Later” options within a row may follow the row's initial priority.

Dependencies: **Doc** document/IDs/transactions; **Input** typed coordinates and command states; **Geo** geometry evaluation; **View** camera/projection; **Query** bounds/spatial index; **Solve** robust intersections/roots; **Topo** region/boundary topology; **Sel** selection; **Style** inherited appearance; **Ref** stable subgeometry references; **Text** font layout; **IO** versioned serialization.

Per-family references support the vendor mapping. Where the official pages reviewed did not establish exact equivalence, this is stated. A command-name mapping is not a full vendor prompt audit; refer to the main report for verified options and evidence gaps.


## 1. Draw and create

Separate segment, path, and freeform representations are fundamental. [Rhino Line][RL], [Polyline][RP], [Curve][RC]; [AutoCAD LINE][AL], [PLINE][AP], [SPLINE][AC]. Other Rhino creation references: [Rectangle](https://docs.mcneel.com/rhino/8/help/en-us/commands/rectangle.htm), [Circle](https://docs.mcneel.com/rhino/8/help/en-us/commands/circle.htm), [Arc](https://docs.mcneel.com/rhino/8/help/en-us/commands/arc.htm), [Ellipse](https://docs.mcneel.com/rhino/8/help/en-us/commands/ellipse.htm), [Polygon](https://docs.mcneel.com/rhino/8/help/en-us/commands/polygon.htm), [Sketch](https://docs.mcneel.com/rhino/8/help/en-us/commands/sketch.htm), [CurveBoolean](https://docs.mcneel.com/rhino/8/help/en-us/commands/curveboolean.htm), [RevCloud](https://docs.mcneel.com/rhino/8/help/en-us/commands/revcloud.htm). AutoCAD mappings also use the [2026 command index][AINDEX].

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Point | Point | POINT | Persistent datum | Single; repeat | Doc/Input/Geo | Point | PT | P1 | Rendered marker size is not geometric size |
| Single line segment | Line | LINE, finish after one segment | Two exact endpoints | Length; angle; single | Doc/Input/Geo | Line Single | — | P1 | Same line entity as continuous mode |
| Independent connected segments | Lines | LINE | Fast continuous drafting | Undo last segment; Close; Enter accept | Doc/Input/Geo | Line | L | P1 | Separate IDs; Escape rolls back current Caderact session |
| Polyline | Polyline | PLINE | One editable connected path | Close; Undo; line/arc modes | Doc/Input/Geo | Polyline | PL | P1 | Line-only first; arcs follow; not grouped Lines |
| Rectangle | Rectangle | RECTANG | Orthogonal closed path | Corners; center; dimensions; rotation | Input/Geo | Rectangle | REC | P1 | Zero width/height invalid; rounded corners later |
| Polygon | Polygon | POLYGON | Regular closed polygon | Sides; center/radius; inscribed/circumscribed | Input/Geo | Polygon | POLY | P1 | Sides integer at least three |
| Circle | Circle | CIRCLE | Exact circular geometry | Center/radius; diameter; 2/3 points; tangent later | Input/Geo/Solve | Circle | C | P1 | Collinear three-point input invalid |
| Arc | Arc | ARC | Exact finite circular curve | Three points; center/start/end; sweep; direction | Input/Geo/Solve | Arc | A | P1 | Disambiguate minor/major; coincident endpoints |
| Ellipse | Ellipse | ELLIPSE | Exact elliptical geometry | Center/axes; rotation; partial arc later | Input/Geo | Ellipse | EL | P2 | Nonuniformly scaled circles need this type |
| Spline, fit points | InterpCrv | SPLINE Fit | Curve through samples | Degree; open/closed; endpoint tangents | Input/Geo/Solve | InterpCurve | IC | P3 | Fit tolerance separate from display precision |
| NURBS, control points | Curve | SPLINE CV | Control-point-defined curve | Degree; knots; weights; periodicity later | Input/Geo | Curve | CV | P3 | Control points generally not points on curve |
| Freehand/sketch | Sketch | SKETCH | Capture hand trajectory | Sampling; simplify; deviation preview | Input/Geo/View | Sketch | SK | P3 | Raw samples distinct from fitted result |
| Construction geometry | Line plus organization; guides | XLINE/RAY; nonplot organization | Persistent drafting aids | Finite/infinite/ray; nonplot role | Geo/View/Style | ConstructionLine | CL | P2 | Role distinct from geometry type |
| Ray | No exact persistent counterpart verified | RAY | Half-infinite reference | Origin; direction | Geo/View/Query | Ray | RAY | P2 | Exclude infinite bounds from Zoom Extents |
| Infinite line | No exact persistent counterpart verified | XLINE | Unbounded reference | Point/direction; horizontal/vertical/angle | Geo/View/Query | InfiniteLine | XL | P2 | Clip for display; never giant finite proxy |
| Boundary extraction | CurveBoolean | BOUNDARY | Extract bounded loops | Pick region; holes; retain sources | Geo/Solve/Topo | Boundary | BD | P2 | Open gaps produce diagnosis, not arbitrary closure |
| Region | Planar curve/region workflows, not exact entity parity | REGION | Area-bearing planar topology | Loops; hole nesting; validation | Geo/Solve/Topo | Region | REG | P2 | Distinct from merely closed Polyline |
| Revision cloud | RevCloud | REVCLOUD | Mark drawing changes | Freehand; existing boundary; arc size; flip | Geo/Input | RevisionCloud | RC | P2 | Closed arc path; arc size in model units |
| Hatch | Hatch | HATCH | Patterned bounded region | Pattern; scale; rotation; origin; associative | Topo/Style/Ref | Hatch | H | P2 | See hatch family; not stored as millions of lines |
| Solid fill | Solid Hatch | HATCH Solid | Filled planar area | Boundary; holes; opacity | Topo/Style | Fill | FILL | P2 | Fill appearance does not alter boundary geometry |

## 2. Modify and curve editing

Verified behavioral details are discussed in the report. Key references: Rhino [Trim](https://docs.mcneel.com/rhino/8/help/en-us/commands/trim.htm), [Offset](https://docs.mcneel.com/rhino/8/help/en-us/commands/offset.htm), [Join](https://docs.mcneel.com/rhino/8/help/en-us/commands/join.htm), [Rebuild](https://docs.mcneel.com/rhino/8/help/en-us/commands/rebuild.htm), [Match](https://docs.mcneel.com/rhino/8/help/en-us/commands/match.htm); AutoCAD [TRIM][ATRIM], [Stretch and Lengthen][AST], [ARRAY][AARRAY]. Remaining command-name counterparts use the [official index][AINDEX]; workflow equivalents are qualified.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Move | Move | MOVE | Translate objects | Base point; displacement; snapped target | Doc/Sel/Input | Move | M | P1 | Atomic; stable IDs retained |
| Copy | Copy | COPY | Duplicate translated objects | Multiple; displacement; count later | Doc/Sel/Input | Copy | CO | P1 | Fresh IDs; copied references remapped |
| Rotate | Rotate | ROTATE | Rotate about pivot | Angle; reference; copy | Doc/Sel/Input/Geo | Rotate | RO | P1 | Typed angle obeys configured convention |
| Scale | Scale; Scale1D/Scale2D workflows | SCALE | Change size around base | Uniform factor; reference length | Doc/Sel/Input/Geo | Scale | SC | P1 | Nonuniform P2 requires conic conversion |
| Mirror | Mirror | MIRROR | Reflect across axis | Two-point axis; keep source | Doc/Sel/Input/Geo | Mirror | MI | P1 | Text readability policy explicit |
| Offset | Offset | OFFSET | Parallel-distance curve | Distance; side; both; corner treatment | Geo/Solve/Topo/Sel | Offset | O | P2 | Cusp/collapse/multiple results; report failures |
| Trim | Trim | TRIM | Remove chosen portions | Explicit cutters; selected side; preview | Geo/Solve/Topo/Sel | Trim | TR | P1 | Do not copy Quick Trim delete-on-no-cut behavior |
| Extend | Extend | EXTEND | Continue to boundary | Boundary; natural/line/arc extension | Geo/Solve/Sel | Extend | EX | P1 | Multiple hits ordered along extension |
| Split | Split | BREAKATPOINT workflow | Divide without discarding pieces | Cutters; picked parameters; retain all | Geo/Solve/Sel | Split | SPL | P1 | New pieces and reference remapping |
| Break | Split then delete workflow | BREAK | Remove interval | Two points; gap; zero-gap split | Geo/Solve/Sel | Break | BR | P2 | Closed curve wrap direction must be shown |
| Join | Join | JOIN; PEDIT Join | Connect compatible pieces | Tolerance; order; preview gaps | Geo/Solve/Sel | Join | J | P1 | No silent large-gap bridge |
| Explode | Explode | EXPLODE | Replace composite with constituents | One level; recursively later | Doc/Geo/Sel/Style | Explode | EXP | P1 | Preserve effective appearance and references |
| Fillet | Fillet | FILLET | Insert tangent circular corner | Radius; trim; branch preview | Geo/Solve/Topo/Sel | Fillet | F | P2 | Impossible radius diagnosed |
| Chamfer | Chamfer | CHAMFER | Bevel corner | Two distances; distance/angle; trim | Geo/Solve/Topo/Sel | Chamfer | CHA | P2 | Distance measured along supporting curves |
| Stretch | Stretch | STRETCH | Move selected vertices | Crossing region; displacement; preview | Sel/Geo/Input | Stretch | STR | P2 | Not generic scale; blocks need explicit treatment |
| Lengthen | Extend workflows; exact counterpart unverified | LENGTHEN | Change curve endpoint by length | Delta; total; percent; picked end | Geo/Solve/Sel | Lengthen | LEN | P2 | Curved length may require iterative solving |
| Align | Orient; Align workflows differ | ALIGN | Map source to target references | One/two point; optional uniform scale | Geo/Input/Sel | Align | AL | P2 | 2D only; reject contradictory point pairs |
| Array controller | Array-family commands | ARRAY | Choose repetition pattern | Rectangular; polar; path; associative later | Doc/Geo/Sel | Array | AR | P2 | Initial result copies; associative entity is separate scope |
| Rectangular array | Array | ARRAYRECT | Regular row/column copies | Rows; columns; spacing; base | Doc/Geo/Sel | ArrayRect | ARRECT | P2 | Counts and distance have distinct units |
| Polar array | ArrayPolar | ARRAYPOLAR | Radial copies | Center; count; sweep; rotate items | Doc/Geo/Sel | ArrayPolar | ARP | P2 | Full-circle endpoint not duplicated |
| Path array | ArrayCrv | ARRAYPATH | Repeat along curve | Count/spacing; align; start offset | Geo/Solve/Sel | ArrayPath | ARPATH | P3 | Arc-length parameterization and frames |
| Curve edit | EditPtOn/PointsOn workflows | SPLINEDIT; PEDIT by type | Edit without accidental conversion | Insert/remove point; close/open | Geo/Sel | EditCurve | EC | P2/P3 | Paths P2; spline editing P3 |
| Control-point editing | PointsOn | Spline CV grips/SPLINEDIT | Modify curve control polygon | Move; weights; knot operations later | Geo/Sel | EditPoints | EP | P3 | Weights positive in initial supported subset |
| Reverse direction | Dir/Flip workflow | REVERSE | Reverse parameter direction | Preview arrows; preserve locus | Geo/Sel/Ref | Reverse | REV | P2 | Update attached parameter references |
| Simplify | SimplifyCrv | PEDIT/OVERKILL partial workflows | Reduce redundant representation | Deviation bound; preserve exact conics | Geo/Solve/Sel | Simplify | SIM | P3 | No exact vendor equivalence implied |
| Rebuild | Rebuild | SPLINEDIT partial workflow | Refit using new curve complexity | Degree; point count; max deviation | Geo/Solve/Sel | Rebuild | REB | P3 | Explicitly geometry-changing |
| Match geometry | Match | No exact equivalent established | Match curve-end continuity | Position; tangent; curvature later | Geo/Solve/Sel | MatchCurve | MC | P3 | Not MatchProperties |
| Match appearance | MatchProperties workflow | MATCHPROP | Copy chosen properties | Layer/color/linetype/weight masks | Sel/Style | MatchProperties | MA | P2 | No geometric continuity effect |
| Divide | Divide | DIVIDE | Mark equal-length intervals | Count; end inclusion; point objects | Geo/Solve | Divide | DIV | P2 | Does not split unless separately requested |
| Measure along | Divide Length workflow | MEASURE | Mark fixed-distance intervals | Spacing; start; remainder; blocks later | Geo/Solve | MeasureAlong | MEA | P2 | Different from read-only length measurement |
| Draw order | BringForward/SendBackward family | DRAWORDER | Control overlapping appearance | Front/back; step; layer defaults | Doc/Style/Sel | DrawOrder | DO | P2 | Never changes geometric coordinates |

## 3. Selection

[Rhino selection][RSEL] and [filters][RF]; [AutoCAD SELECT][ASEL]. Names below include UI actions, not just standalone commands. Overlap menus and cycling solve the same user problem through different interaction designs.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Click selection | Click | Click | Select visible target | Aperture; overlap candidates | View/Query/Sel | Select | SEL | P1 | Hit-test geometry, not only bounding boxes |
| Multi-selection | Shift add; Ctrl remove | Add mode; Shift remove | Build working set | Add/remove/toggle policy | Sel | Select Add/Remove | — | P1 | Proposed Caderact modifiers configurable |
| Window | Left-to-right window | Window | Fully contain objects | Drag; explicit window | View/Query/Sel | Select Window | — | P1 | Containment tested in screen frame |
| Crossing | Right-to-left crossing | Crossing | Select touching objects | Drag; explicit crossing | View/Query/Sel | Select Crossing | — | P1 | Distinct preview style |
| Fence | SelFence workflow | Fence option | Select intersected objects | Open point chain | Query/Sel/Geo | Select Fence | SF | P2 | Not area containment |
| Polygon | SelWindow/SelCrossing polygon workflows | WPolygon/CPolygon | Nonrectangular selection | Window/crossing polygon | Query/Sel/Geo | Select Polygon | SP | P2 | Simple polygon validation |
| Select all | SelAll | ALL / Select All | Select eligible objects | Visible/unlocked scope | Sel/Doc | SelectAll | SA | P1 | Must not unexpectedly include hidden geometry |
| Previous | SelPrev | Previous | Recover prior set | Existing eligible IDs | Sel/Doc | SelectPrevious | SPREV | P1 | Drop deleted IDs |
| Invert | Invert | No exact command established | Complement eligible set | Current scope | Sel/Doc | SelectInvert | SI | P2 | Never invert into hidden/locked objects |
| Similar | Selection commands/filter workflow | SELECTSIMILAR | Select matching properties | Type; layer; style mask | Sel/Style | SelectSimilar | SS | P2 | Expose matching criteria |
| By type | SelCrv/SelPt family | QSELECT/filters | Filter entity kind | Multi-type | Sel/Geo | SelectType | ST | P1 | Type names consistent with Properties |
| By layer | SelLayer | QSELECT/layer workflow | Select layer contents | Current/chosen; descendants | Sel/Style | SelectLayer | SL | P1 | Hierarchy scope explicit |
| Filters | SelectionFilter | FILTER/QSELECT | Restrict candidates | Persistent/one-shot; visible indicator | Sel/Style | SelectionFilter | SFILTER | P2 | Do not silently reset after failed clicks |
| Sub-object/control points | Sub-object selection; PointsOn | Grips/sub-object workflows | Select editable component | Vertex; segment; control point | Sel/Geo/Ref | SelectComponent | — | P2/P3 | Store owner ID plus stable component reference |
| Selection cycling | Selection menu | Selection cycling | Resolve overlaps | Next/previous; candidate list | Sel/Query/View | CycleSelection | — | P1 | Independent of snap candidate cycling |
| During commands | Pre/post selection | Preselection/SELECT prompts | Reuse valid working set | Filter; add/remove; confirm | Input/Sel | Command selection phase | — | P0 | Command owns eligibility, not global guessing |

## 4. Layers, organization and properties

[Rhino Layers][RLY], [object properties][RPR]; [AutoCAD layers][ALY], [layer states][ALS], [properties][APR]. This family specifies a Caderact model rather than claiming identical layer hierarchies or metadata representations.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Create/delete/rename layers | Layer panel | LAYER | Organize objects | Name; parent; delete migration | Doc/Style | Layer | LA | P1 | Never delete occupied layer without disposition |
| Current layer | Current layer | Current layer | Destination for new entities | Choose unlocked visible layer | Doc/Style | Layer Current | — | P1 | Creation destination, not selection filter |
| Visibility and lock | Layer visibility/lock | On/Off/Freeze/Lock | Control editing and display | Hide; lock; isolate | Doc/Style/Sel | Layer Visibility/Lock | — | P1 | Do not import Freeze as mere lock |
| Layer appearance | Layer color/linetype/print width | Color/linetype/lineweight | Inherited default appearance | Color; dash; weight; opacity | Doc/Style | Layer Properties | — | P1/P2 | Basic color P1; print styling P2 |
| Hierarchy | Sublayers | Named layers/filter organization, not equivalent hierarchy | Nested organization | Parent; reparent; inheritance | Doc/Style | Layer Parent | — | P2 | Flattening mapping needed for DWG/DXF |
| Layer states | LayerStateManager | LAYERSTATE | Restore configuration | Save; apply; missing-layer handling | Doc/Style | LayerState | LS | P2 | Not duplicate geometry |
| Object assignment | ChangeLayer/properties | Properties/CHPROP | Move object to layer | Keep effective appearance option | Doc/Sel/Style | ChangeLayer | CHL | P1 | Distinguish inherited and explicit styles |
| Isolate | Isolate; layer workflows | ISOLATEOBJECTS/LAYISO | Temporarily focus objects | Objects/layers; restore | Sel/Style | Isolate | ISO | P2 | Transient isolate state, not destructive hide edits |
| Groups | Group | GROUP | Select related objects together | Create; ungroup; ignore temporarily | Doc/Sel | Group | G | P2 | Members remain independent entities |
| Blocks/instances | Block/Insert | BLOCK/INSERT | Reusable definitions | Base; transform; name; redefine | Doc/Geo/Style/Ref | Block/Insert | B/INS | P2 | Shared definition; cycle detection |
| Object metadata/names | Name/User Text properties | Properties/XData/attributes workflows | Attach structured meaning | Name; typed key/value; namespace | Doc/Sel | Metadata | MD | P2 | Free text not a substitute for schema |
| Geometry/type/coordinates | Properties/details | Properties | Inspect and edit exact geometry | Type-specific fields; units | Doc/Geo/Sel/Input | Properties | PR | P1 | Read-only derived fields distinguished |
| Geometric dimensions | Object-specific properties | Object-specific properties | Edit length/radius etc. | Constraint-aware value changes | Geo/Solve/Sel | Properties Geometry | — | P1/P2 | Do not confuse with dimension annotations |
| Object appearance | Properties | Properties | Override layer defaults | Color; linetype; weight; transparency | Style/Sel | Properties Appearance | — | P2 | Show ByLayer versus explicit value |
| Mixed selection properties | Properties workflow | Properties palette | Batch-edit common fields | Mixed value; type filtering | Sel/Style/Doc | Properties Selection | — | P2 | Atomic edits; no silent coercion |

## 5. Annotation, dimensions and hatch

[Rhino dimensions][RD], [styles][RAN], [hatch][RH], [History][RHIS]; [AutoCAD DIM][AD], [DIMASSOC][ADA], [TABLE][ATABLE], [hatch][AH]. Vendor table and multileader parity is not established. [Rhino Text](https://docs.mcneel.com/rhino/8/help/en-us/commands/text.htm) and [Leader](https://docs.mcneel.com/rhino/8/help/en-us/commands/leader.htm) establish those counterparts.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Single/multiline text | Text | TEXT/MTEXT | Drawing labels | Content; font; height; alignment; wrap | Doc/Text/Style/Input | Text | T | P2 | Model or paper sizing explicit |
| Leader | Leader | LEADER/MLEADER | Callout with pointer | Arrow; landing; text; attachment | Geo/Text/Style/Ref | Leader | LE | P2 | Target may be associative |
| Multileader | Leader workflows; full parity unverified | MLEADER | Multiple callout branches | Add/remove branch; shared text | Geo/Text/Ref | MultiLeader | ML | P3 | Do not claim Rhino identical entity |
| Notes | Notes document workflow | Text/document workflows | Store document-level notes | Plain text; optional sheet placement | Doc/Text | Notes | NOTE | P2 | Document notes versus plotted text |
| Tables | Native equivalent not established | TABLE | Structured tabular annotation | Rows; columns; cell formats | Doc/Text/Style | Table | TB | P3 | External data links later |
| Center marks | CenterMark | CENTERMARK | Mark circular centers | Size; style; associative | Geo/Ref/Style | CenterMark | CM | P2 | Not an object-snap marker |
| Center lines | Centerline drafting workflow | CENTERLINE | Show symmetry/center axis | References; overhang; style | Geo/Ref/Style | CenterLine | CE | P2 | Reference loss warning |
| Annotation styles | Annotation Styles | DIMSTYLE/STYLE/MLEADERSTYLE | Reusable annotation defaults | Text; arrows; units; tolerance format | Doc/Text/Style | AnnotationStyle | AS | P2 | Named styles, explicit local overrides |
| Annotation scaling | Layout/model annotation scale | Annotative scales | Consistent paper readability | Paper height; viewport scale | View/Text/Style | AnnotationScale | ASC | P2 | Never scale measured model geometry |
| Linear dimension | Dim | DIMLINEAR/DIM | Horizontal/vertical measurement | Orientation; position; style | Geo/Ref/Text | DimLinear | DLI | P2 | Projected distance |
| Aligned dimension | DimAligned | DIMALIGNED | Distance along two points | Placement; offset | Geo/Ref/Text | DimAligned | DAL | P2 | True point-to-point distance |
| Angular dimension | DimAngle | DIMANGULAR | Angle between directions | Branch; placement | Geo/Ref/Text | DimAngle | DAN | P2 | Acute/obtuse choice explicit |
| Radius dimension | DimRadius | DIMRADIUS | Label circular radius | Leader placement; style | Geo/Ref/Text | DimRadius | DRA | P2 | Not arbitrary spline curvature |
| Diameter dimension | DimDiameter | DIMDIAMETER | Label circular diameter | Inside/outside placement | Geo/Ref/Text | DimDiameter | DDI | P2 | Symbol and units are formatting |
| Arc-length dimension | DimCurveLength; presentation differs | DIMARC | Label circular arc length | Arc reference; placement | Geo/Ref/Text | DimArcLength | DAR | P2 | Generic curve length annotation later |
| Ordinate dimension | DimOrdinate | DIMORDINATE | Coordinate from datum | X/Y; datum; leader | Geo/Ref/Text | DimOrdinate | DOR | P2 | Datum reference, not view origin |
| Baseline dimensions | Dim baseline workflow | DIMBASELINE | Multiple dimensions from common origin | Base; spacing; continue | Geo/Ref/Text | DimBaseline | DBA | P2 | Retain shared datum reference |
| Continued dimensions | Dim continue workflow | DIMCONTINUE | Chain adjacent dimensions | Next point; chain spacing | Geo/Ref/Text | DimContinue | DCO | P2 | Rounding can make displayed sums differ |
| Dimension styles/units/precision | Annotation Styles | DIMSTYLE | Consistent measurement presentation | Units; decimal/fraction; zeros; prefixes | Doc/Text/Style | DimensionStyle | DS | P2 | Separate angular and length precision |
| Dimension tolerances | Annotation style tolerance settings | Dimension style tolerance settings | Communicate permitted variation | Bilateral; limits; deviation | Doc/Text/Style | DimTolerance | DTOL | P2 | Manufacturing tolerance, not solver epsilon |
| Associative dimensions | Dimension History | Associative dimensions | Update when references change | Link; relink; detach | Doc/Geo/Ref/Text | DimAssociate | DASSOC | P2 | Flag orphaned references |
| Dimension editing | Properties/grips | Properties/grips/DIMEDIT | Reposition or restyle annotation | Text placement; overrides; reassociate | Doc/Ref/Text/Sel | DimEdit | DE | P2 | Override must not falsify measured value invisibly |
| Hatch patterns | Hatch | HATCH | Bounded repeated pattern | Pattern; scale; angle; origin | Topo/Style | Hatch Pattern | — | P2 | Pattern units defined separately from pixel density |
| Solid/gradient fill | Hatch fill options | HATCH/GRADIENT | Solid or shaded area | Solid; opacity; gradient later | Topo/Style | Fill | FILL | P2/P3 | Solid P2; decorative gradients P3 |
| Boundary detection | Hatch/CurveBoolean | HATCH boundary selection | Find outer and inner loops | Pick interior; select loops; gap diagnostics | Topo/Solve | Hatch Boundary | — | P2 | Nested holes require consistent winding model |
| Associative hatch | History workflow; exact update coverage requires testing | Associative hatch | Update fill after edits | Link; detach; relink | Topo/Ref/Doc | Hatch Associate | — | P2 | Do not assume generic History guarantees all edits |
| Hatch editing | Hatch properties | HATCHEDIT | Change pattern or boundary | Origin; angle; scale; boundary | Topo/Style/Sel | HatchEdit | HE | P2 | Boundary edits invalidate cached tessellation |

## 6. Measurement and analysis

[Rhino measurement commands][RME]; [AutoCAD MEASUREGEOM][AME]. These are proposed read-only queries; Divide and MeasureAlong above deliberately create objects.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Distance | Distance | DIST/MEASUREGEOM | Measure two points | Delta X/Y; total; copy result | Input/Geo | Distance | DI | P1 | Read-only; document unit display |
| Curve length | Length | Properties/LIST/MEASUREGEOM workflows | Evaluate selected curve length | Single/total; precision | Geo/Solve/Sel | Length | LENGTH | P1 | Analytic exact forms; numeric integration for splines |
| Area | Area | AREA/MEASUREGEOM | Measure bounded area | Holes; add/subtract; selection | Geo/Topo/Solve | Area | AREA | P2 | Squared-unit conversion |
| Perimeter | Length/boundary workflow | AREA/MEASUREGEOM | Measure region boundary | Outer only/all loops | Geo/Topo | Perimeter | PER | P2 | State whether holes included |
| Angle | Angle | MEASUREGEOM Angle | Measure directions | Three points; curves; signed result | Input/Geo | Angle | ANG | P1 | Do not silently infer tangent on ambiguous pick |
| Radius | Radius | MEASUREGEOM Radius | Inspect circular size | Circle/arc; point of curvature later | Geo/Sel | Radius | RAD | P1 | Local curvature not same as global radius |
| Diameter | Diameter | Properties/radius workflow | Inspect circular diameter | Circle/arc | Geo/Sel | Diameter | DIA | P1 | No standalone command parity asserted |
| Coordinates | EvaluatePt/point properties | ID | Report exact point | World/local; copy formatted/raw | Input/Geo | Coordinates | ID | P1 | Snap-resolved point, not raw cursor |
| Geometry information | What/properties | LIST/Properties | Inspect entity structure | Type; closure; length; topology; ID | Geo/Sel | Info | INFO | P1 | Computed versus stored fields labeled |
| Validity/deviation | Check; deviation workflows | Validation/inspection workflows | Diagnose bad or refitted geometry | Self-intersection; gaps; max deviation | Geo/Solve/Topo | Validate | VAL | P2/P3 | Core invariants P0; user diagnostics expand later |

## 7. Units, input and drafting aids

[Rhino units][RU], [grid][RG], [snaps][RS], [Ortho][RO], [SmartTrack][RT]; [AutoCAD UNITS][AU], [INSUNITS][AINS], [grid][AG], [snap spacing][AGS], [object snaps][AS], [typed-input priority][APREF]. For mathematical definitions, candidate arbitration, one-shot state, and limitations see report sections 5–10. Rows intentionally group configurable snap modes; they are not separate geometry-producing commands.

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Document/model units | Document Units | Units conventions plus INSUNITS | Define coordinate physical scale | Metric/customary/custom factor; conversion choice | Doc | Units | UN | P0 | Format change not geometry conversion |
| Display formatting | Units precision | UNITS | Format values | Decimal; fractional; engineering | Doc/Input | UnitFormat | UF | P0 | No rounding of stored coordinates |
| Insertion units | Import unit handling | INSUNITS | Scale imported/inserted objects | Source/target; unitless prompt | Doc/IO | InsertionUnits | IU | P1 | Never guess unknown source scale |
| Paper/annotation units | Layout units/styles | Layouts/styles/plot settings | Separate paper and model length | Paper unit; annotation scale | Doc/View/Style | PaperUnits | PU | P2 | Different ownership from model unit |
| Tolerance settings | Document tolerance | No directly equivalent universal drawing epsilon | Set modeling acceptance | Absolute; angle; diagnostics | Doc/Geo/Solve | Tolerance | TOL | P0 | Operation-specific contracts remain necessary |
| Angle formatting | Angle input/settings | UNITS/-UNITS | Format angular quantities | Degrees/radians; DMS/grads later | Doc/Input | AngleFormat | AF | P1/P2 | Store radians; separate display precision |
| Cartesian/polar input | Coordinate entry | Coordinate entry | Exact point placement | Absolute; relative; polar; units | Input/Geo | Point input grammar | — | P0 | One resolver shared with preview |
| Direct distance | Distance constraint | Direct distance entry | Length along chosen direction | Typed distance; direction confirmation | Input/Geo | Distance input | — | P1 | No second, inconsistent coordinate path |
| Dynamic input | Prompt/cursor feedback workflows | Dynamic Input | Read values near cursor | Readout; explicit focused edit | Input/View | DynamicInput | DYN | P2 | Same parser as command line |
| Visible grid | Grid | GRID | Visual scale reference | X/Y spacing; major interval; extent; axes | Doc/View | Grid | GRID | P0 | Adaptive display independent of snap lattice |
| Grid snap | GridSnap | SNAP | Quantize free picks | X/Y steps; origin; enable | Doc/Input | GridSnap | GS | P1 | Typed coordinate priority explicit |
| Object snap master | Object snaps | OSNAP | Enable running object aids | Saved types; temporary suspension | Input/Query/Geo | Snap | SNAP | P1 | Disabling preserves checks but stops evaluation |
| Endpoint/midpoint | End/Mid | Endpoint/Midpoint | Exact segment landmarks | Running; one-shot; cycle | Query/Geo | Snap End/Mid | — | P1 | Midpoint semantics per entity |
| Center/quadrant | Cen/Quad | Center/Quadrant | Conic landmarks | Running; one-shot | Query/Geo | Snap Center/Quadrant | — | P1 | Define quadrant frame |
| Intersection/apparent | Int; apparent option | Intersection/Apparent Intersection | Curve crossing | Actual; projected later if meaningful | Query/Geo/Solve | Snap Intersection | — | P1/P4 | Strict 2D needs actual intersection only |
| Nearest | Near | Nearest | Closest point on curve | Running; one-shot; cycle | Query/Geo/Solve | Snap Nearest | — | P1 | Lower preference than discrete landmarks |
| Perpendicular | Perp | Perpendicular | Normal foot from reference | Deferred reference; branch choice | Query/Geo/Solve/Input | Snap Perpendicular | — | P2 | Needs known start/reference |
| Tangent | Tan | Tangent/deferred tangent | Tangent connection | Reference; multiple solutions | Query/Geo/Solve/Input | Snap Tangent | — | P2 | No real tangent from interior circle point |
| Point/node/vertex | Point; Vertex context differs | Node; endpoint/subentity workflows | Snap to stored datum or vertex | Type filter; one-shot | Query/Geo | Snap Point/Vertex | — | P1/P2 | Rhino mesh Vertex not a generic 2D equivalence |
| Extension/parallel | SmartTrack workflows | Extension/Parallel snaps | Infer beyond or parallel to geometry | Acquire; clear; temporary guide | Query/Geo/Input | Snap Extension/Parallel | — | P2 | Not persistent construction entities |
| One-shot snap overrides | One-shot snaps | Temporary object snaps | Use one mode for next pick | Choose; consume; cancel | Input/Query | SnapOnce | SO | P1 | Do not mutate saved running mask |
| Ortho | Ortho | ORTHO | Restrict free direction | On/off; temporary override | Input/Geo | Ortho | ORTHO | P1 | Typed coordinates remain exact |
| Angle snap/polar tracking | Angle constraint/Ortho/SmartTrack | Polar Tracking | Acquire angular directions | Increment; additional angles; relative | Input/Geo/View | AngleSnap | ASNAP | P2 | Explicit hard angle differs from soft acquisition |
| Tracking | SmartTrack | Object Snap Tracking | Infer alignments from acquired points | Acquire/clear; delays; guide limits | Input/Query/Geo/View | Track | TRACK | P2 | Temporary state; no model geometry |

## 8. Commands, navigation, templates and exchange

[Rhino keyboard behavior][RK], [AutoCAD basics][AB], [Rhino templates][RN], [AutoCAD templates][AN], [Rhino DXF/DWG exchange][RX], [SVG exchange][RSVG], [PDF export considerations][APDF]. Navigation mappings also use [Rhino Zoom](https://docs.mcneel.com/rhino/8/help/en-us/commands/zoom.htm), [NamedView](https://docs.mcneel.com/rhino/8/help/en-us/commands/namedview.htm), and the [AutoCAD command index][AINDEX].

| Capability | Rhino equivalent | AutoCAD equivalent | Purpose | Important Caderact options | Dependencies | Caderact command | Aliases | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Command registry/aliases/autocomplete | Command prompt/aliases | Command line/aliases | Discover and dispatch tools | Canonical names; unique aliases; suggestions | Input/Doc | Commands | — | P0 | Click/Enter/Space launch same command path |
| Options/history/repeat | Command options/history/repeat | Command options/history/repeat | Efficient expert input | Prompt schema; repeat; history | Input | CommandHistory | HIST | P0/P1 | Repeat names/options, not stale picked coordinates |
| Accept/cancel/undo | Enter/Escape/Undo workflows | Enter/Escape/UNDO workflows | Control transaction lifetime | Accept; cancel session; undo last step | Doc/Input | Undo/Redo | U/REDO | P0 | Caderact Line whole-session Escape is deliberate |
| Transparent navigation | Navigation during commands | Transparent Pan/Zoom | Navigate without losing tool | Suspend picks; resume | Input/View | Pan/Zoom | P/Z | P0 | Do not introduce arbitrary nested editing commands |
| Pan | Pan | PAN | Move view | Middle-button drag; existing shortcut | View/Input | Pan | P | P0 | Do not modify geometry |
| Zoom | Zoom | ZOOM | Change view scale | Wheel anchor; horizontal drag | View/Input | Zoom | Z | P0 | Cursor/world anchor consistent; numerical guards |
| Extents | Zoom Extents | ZOOM Extents | Fit eligible content | Visible drawing; exclude infinite guides | View/Query | ZoomExtents | ZE | P1 | Margin; empty/point-only handling |
| Window zoom | Zoom Window | ZOOM Window | Fit selected view rectangle | Drag corners | View/Input | ZoomWindow | ZW | P1 | Reject zero-area rectangle |
| Selected zoom | Zoom Selected | ZOOM Object | Fit selection | Current set | View/Query/Sel | ZoomSelected | ZS | P1 | No eligible selection feedback |
| Previous view | Zoom Previous | ZOOM Previous | Restore camera history | Previous/next | View | PreviousView | ZP | P1 | Separate from document Undo |
| Named views | NamedView | VIEW | Save useful framing | Name; update; delete | Doc/View | NamedView | NV | P2 | Camera state, not object snapshot |
| Document templates | New/template 3DM | DWT | Reusable starting settings | Units; layers; styles; optional content | Doc/IO | New/Template | NEW | P0/P2 | P0 native document; P2 managed templates |
| Native save/open | 3DM save/open | DWG save/open | Lossless Caderact persistence | Version; validation; migrations | Doc/IO | Save/Open | SAVE/OPEN | P0 | Foreign export not native save substitute |
| DXF exchange | DXF import/export | DXF import/export | First editable CAD exchange | Versioned entity subset; units; report | Doc/Geo/Style/IO | ImportDXF/ExportDXF | — | P1/P2 | Initial geometry/layers first; semantic expansion P2 |
| DWG exchange | DWG import/export | Native DWG | Wider drafting exchange | Version; conversion dependency; loss report | Doc/Geo/Style/IO | ImportDWG/ExportDWG | — | P3 | Evaluate licensed SDK and browser constraints |
| 3DM exchange | Native 3DM | No direct parity promised | Exchange Rhino curves/organization | Planar subset; units; unsupported report | Doc/Geo/Style/IO | Import3DM/Export3DM | — | P3 | No 3D design in this task |
| SVG exchange | SVG import/export | No native parity established | 2D graphics exchange | Physical scale; paths; text policy | Geo/Style/Text/IO | ImportSVG/ExportSVG | — | P2 | Unitless user coordinates require explicit scale |
| PDF output | PDF print/export workflow | PDF plot/export | Sheet delivery | Page; scale; fonts; vector/raster | View/Style/Text/IO | ExportPDF | PDF | P2 | Not lossless CAD interchange |
| PDF geometry import | PDF import workflow | PDFIMPORT | Recover graphical primitives | Scale confirmation; cleanup; warnings | Geo/Style/Text/IO | ImportPDF | — | P3 | No assumption of recovered dimensions/constraints |

## Coverage and implementation cautions

- Existing footer labels are not evidence that solvers exist. Grid Snap, Snap, Track, and angle controls need distinct state and tested behavior.
- “Planar” is not a meaningful freedom toggle in a strictly 2D document; keep all geometry in the drawing plane. Do not implement a 3D Planar system here.
- A Gumball-like transform manipulator is a possible P3 **2D** presentation of Move/Rotate/Scale, not a prerequisite or a new geometry kernel.
- App settings, help, and profile UI are outside this geometric command inventory. Put command preferences and aliases in application preferences, not copied into every object.
- Capability coverage is complete for the requested families; vendor option-by-option compatibility is not certified. The report's evidence-gap register identifies tests needed before compatibility promises.

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

