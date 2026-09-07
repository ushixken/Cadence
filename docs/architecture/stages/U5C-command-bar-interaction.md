# U5C — Command Bar Interaction

U5C gives the command field one explicit click owner. Clicking its background, command prefix, passive instruction, or unused editable area focuses the real input. Native command-option buttons retain their own hitboxes and route through `CommandRouter.activateOption()` before focus returns to the input.

Space uses the same idle autocomplete acceptance path as Enter. A quick Space tap with non-empty idle command text executes the selected or deterministic command. A quick tap with empty text repeats the last repeatable command. Holding Space for 220 ms, dragging with Space, or using Ctrl+Space remains viewport navigation and never launches a command.

During an active command, a quick Space tap also uses the exact Enter submission operation. It submits the current value, accepts an exposed empty default, or performs the phase's existing empty-Enter behavior. Space is owned on keydown but resolved only on keyup, so it never inserts a literal character and a held or drag-consumed interaction never submits.

The command shell, prefix, instruction, input region, and unused field space consistently use the text cursor and focus the real input. Native interactive options keep pointer cursor and button ownership.

Command identifiers are compared case-insensitively after removing hyphens and underscores. Thus a canonical `SomeCommand` may be invoked as `somecommand`, `some-command`, or `some_command`; an embedded literal space is not removed or required. The same normalization is used by exact resolution, aliases, prefix matching, and autocomplete search.

Normalization is restricted to idle command-name lookup. Values submitted to an active command are preserved for command-specific parsing, so coordinates, numeric values, and future text, layer-name, filename, or property inputs are not rewritten.
