const commandInput = document.querySelector("#command-input")
const commandSuggestions = document.querySelector("#command-suggestions")
let selectedSuggestionIndex = 0

function setCommandHint(message) {
  commandInput.placeholder = message
  commandInput.classList.toggle("has-active-command", message !== "Type a command...")
}

const commandRegistry = window.CaderactCommandRegistry.createRegistry([
  { name: "Line", aliases: ["L"], activate: context => window.caderactViewport.createLineCommandSession(context) },
])
const commandRouter = window.CaderactCommandRouter.createRouter({ registry: commandRegistry, setPrompt: setCommandHint })
window.caderactCommandRegistry = commandRegistry
window.caderactCommandRouter = commandRouter

function getMatchingCommands(value) { return commandRegistry.matches(value) }

function hideSuggestions() {
  commandSuggestions.hidden = true
  commandSuggestions.innerHTML = ""
  selectedSuggestionIndex = 0
}

function showSuggestions() {
  if (commandRouter.isActive) { hideSuggestions(); return [] }
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) { hideSuggestions(); return matches }
  selectedSuggestionIndex = Math.min(selectedSuggestionIndex, matches.length - 1)
  commandSuggestions.innerHTML = matches.map((command, index) =>
    `<button class="command-suggestion${index === selectedSuggestionIndex ? " is-selected" : ""}" type="button" data-command-index="${index}">${command.name}</button>`,
  ).join("")
  commandSuggestions.hidden = false
  return matches
}

function applyCommandResult(outcome) {
  if (outcome.status === "command-started") {
    commandInput.value = ""
    commandInput.blur()
    hideSuggestions()
  } else if (outcome.status === "unknown-command") {
    commandInput.value = ""
    hideSuggestions()
    setCommandHint(`Unknown command: ${outcome.input}`)
  } else if (outcome.status === "invalid-input" && outcome.reason === "empty-command") {
    setCommandHint("Type a command...")
  }
  return outcome
}

function confirmSelectedCommand() {
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) return
  commandInput.value = matches[selectedSuggestionIndex].name
  hideSuggestions()
}

function runCommandInput() { return applyCommandResult(commandRouter.execute(commandInput.value)) }

function resetCommandInput() {
  commandInput.value = ""
  setCommandHint(commandRouter.currentPrompt)
  hideSuggestions()
}

function isTypingInAnotherField(target) {
  return target instanceof HTMLElement && target !== commandInput &&
    (target.matches("input, textarea, select") || target.isContentEditable)
}

commandInput.addEventListener("input", () => { selectedSuggestionIndex = 0; showSuggestions() })

commandInput.addEventListener("keydown", (event) => {
  const matches = getMatchingCommands(commandInput.value)
  if (commandRouter.isActive && event.key === "Enter") {
    event.preventDefault(); applyCommandResult(commandRouter.finishActive()); resetCommandInput(); return
  }
  if (commandRouter.isActive && event.key === "Escape") {
    event.preventDefault(); applyCommandResult(commandRouter.cancelActive()); resetCommandInput(); return
  }
  if (event.key === "ArrowDown" && matches.length > 0) {
    event.preventDefault(); selectedSuggestionIndex = (selectedSuggestionIndex + 1) % matches.length; showSuggestions()
  } else if (event.key === "ArrowUp" && matches.length > 0) {
    event.preventDefault(); selectedSuggestionIndex = (selectedSuggestionIndex - 1 + matches.length) % matches.length; showSuggestions()
  } else if (event.key === "Tab" && matches.length > 0) {
    event.preventDefault(); confirmSelectedCommand()
  } else if ((event.key === "Enter" || event.key === " ") && commandInput.value.trim() !== "") {
    event.preventDefault(); runCommandInput()
  }
})

commandSuggestions.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".command-suggestion")
  if (!suggestion || commandRouter.isActive) return
  const matches = getMatchingCommands(commandInput.value)
  selectedSuggestionIndex = Number(suggestion.dataset.commandIndex)
  const selected = matches[selectedSuggestionIndex]
  if (selected) applyCommandResult(commandRouter.execute(selected.name))
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target !== commandInput && commandRouter.isActive) {
    const outcome = commandRouter.finishActive()
    event.preventDefault()
    if (outcome.status === "command-completed") { resetCommandInput(); commandInput.blur() }
    return
  }
  if (event.key === "Escape") {
    if (commandRouter.isActive) {
      commandRouter.cancelActive(); event.preventDefault(); resetCommandInput(); commandInput.blur()
    } else if (!commandSuggestions.hidden || commandInput.value !== "") {
      event.preventDefault(); resetCommandInput(); commandInput.blur()
    }
    return
  }

  const isPrintableKey = event.key.length === 1 && event.code !== "Space"
  if (!isPrintableKey || commandRouter.isActive || event.ctrlKey || event.altKey || event.metaKey || isTypingInAnotherField(event.target)) return
  if (event.target !== commandInput) {
    commandInput.focus()
    commandInput.value += event.key
    selectedSuggestionIndex = 0
    showSuggestions()
    event.preventDefault()
  }
})
