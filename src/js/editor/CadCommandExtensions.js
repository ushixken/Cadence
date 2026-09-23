// AF1: registration and dependency boundary for new CAD operations.
// Planners remain pure; sessions receive only the services they request here.
(() => {
  function create({ getServices }) {
    if (typeof getServices !== "function") throw new Error("CAD command services are required")
    const registrations = []
    function register({ name, aliases = [], priority = 0, repeatable = true, planner, createSession }) {
      if (typeof name !== "string" || !name.trim() || typeof planner?.plan !== "function" || typeof createSession !== "function") throw new Error("Invalid CAD command extension")
      if (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== "string" || !alias.trim())) throw new Error("Invalid CAD command aliases")
      if (registrations.some(entry => entry.name === name)) throw new Error(`Duplicate CAD command extension ${name}`)
      const entry = Object.freeze({ name, aliases: Object.freeze([...aliases]), priority, repeatable,
        activate: context => createSession(Object.freeze({ ...getServices(), planner, activation: context })) })
      registrations.push(entry)
      return entry
    }
    return Object.freeze({ register, definitions: () => Object.freeze([...registrations]) })
  }
  window.CaderactCadCommandExtensions = Object.freeze({ create })
})()
