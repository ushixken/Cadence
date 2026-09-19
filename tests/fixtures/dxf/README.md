# DXF interoperability fixtures

These fixtures are original, hand-authored test data based on the public Autodesk ASCII DXF group-code specification. They are intentionally small and legally safe to redistribute.

- `cad-export-like-ac1018.dxf` models common output from desktop CAD writers: legal noncanonical section/table ordering, handles, owner references, subclass markers, scientific numeric notation, extra ignorable metadata, a named layer/style, geometry, Text, and a semantic linear Dimension with an anonymous presentation block.

Tests also derive CRLF and whitespace variants from these source files so separate byte-identical fixtures are unnecessary.
