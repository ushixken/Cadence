// U1: immutable command definitions, case-insensitive lookup, and autocomplete.
(() => {
  const normalize = value => typeof value === "string" ? value.trim().toLowerCase() : ""

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
    return Object.freeze({ resolve, matches, commands: () => ordered })
  }

  window.CaderactCommandRegistry = Object.freeze({ createRegistry })
})()
