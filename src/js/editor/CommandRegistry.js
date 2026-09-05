// U1: immutable command definitions, case-insensitive lookup, and autocomplete.
(() => {
  const normalize = value => typeof value === "string" ? value.trim().toLowerCase() : ""

  function matchCandidate(query, candidate, field) {
    const value = normalize(candidate)
    let category, indices
    if (value === query) category = field === "canonical" ? 0 : 1
    else if (value.startsWith(query)) category = field === "canonical" ? 2 : 3
    else {
      const substringAt = value.indexOf(query)
      if (substringAt >= 0) category = field === "canonical" ? 4 : 5
      else {
        indices = []
        let cursor = 0
        for (const character of query) {
          const found = value.indexOf(character, cursor)
          if (found < 0) return null
          indices.push(found); cursor = found + 1
        }
        category = 6
      }
    }
    if (!indices) {
      const start = category <= 3 ? 0 : value.indexOf(query)
      indices = Array.from({ length: query.length }, (_, index) => start + index)
    }
    const start = indices[0] ?? 0
    const gaps = indices.length > 1 ? indices.at(-1) - start + 1 - indices.length : 0
    return { category, indices: Object.freeze(indices), start, gaps, candidate, field }
  }

  function createRegistry(definitions) {
    const commands = [], names = new Map()
    for (const source of definitions) {
      if (!source || typeof source.name !== "string" || !source.name.trim() || typeof source.activate !== "function") {
        throw new Error("Invalid command definition")
      }
      const name = source.name.trim()
      const aliases = Object.freeze(Array.from(source.aliases || [], alias => String(alias).trim()).filter(Boolean))
      const definition = Object.freeze({ name, aliases, activate: source.activate })
      for (const candidate of [name, ...aliases]) {
        const key = normalize(candidate)
        if (names.has(key)) throw new Error(`Duplicate command name or alias ${candidate}`)
        names.set(key, definition)
      }
      commands.push(definition)
    }
    commands.sort((a, b) => a.name.localeCompare(b.name))
    const ordered = Object.freeze(commands)

    function resolve(value) { return names.get(normalize(value)) || null }
    function matches(value) {
      const prefix = normalize(value)
      if (!prefix) return Object.freeze([])
      return Object.freeze(ordered.filter(command =>
        [command.name, ...command.aliases].some(candidate => normalize(candidate).startsWith(prefix)),
      ))
    }
    function search(value, { limit = 8 } = {}) {
      const query = normalize(value)
      if (!query || !Number.isInteger(limit) || limit <= 0) return Object.freeze([])
      const results = []
      for (const command of ordered) {
        const candidates = [matchCandidate(query, command.name, "canonical"),
          ...command.aliases.map(alias => matchCandidate(query, alias, "alias"))].filter(Boolean)
        if (!candidates.length) continue
        candidates.sort((a, b) => a.category - b.category || a.start - b.start || a.gaps - b.gaps ||
          a.candidate.length - b.candidate.length || a.candidate.localeCompare(b.candidate))
        const match = candidates[0]
        results.push(Object.freeze({ command, category: match.category, field: match.field,
          candidate: match.candidate, indices: match.indices, start: match.start, gaps: match.gaps }))
      }
      results.sort((a, b) => a.category - b.category || a.start - b.start || a.gaps - b.gaps ||
        a.candidate.length - b.candidate.length || a.command.name.localeCompare(b.command.name))
      return Object.freeze(results.slice(0, limit))
    }
    return Object.freeze({ resolve, matches, search, commands: () => ordered })
  }

  window.CaderactCommandRegistry = Object.freeze({ createRegistry, matchCandidate })
})()
