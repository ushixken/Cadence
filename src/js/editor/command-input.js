const commandInput = document.querySelector("#command-input")
const commandSuggestions = document.querySelector("#command-suggestions")
const commandHistory = document.querySelector("#command-history")
let selectedSuggestionIndex = 0
let suggestionExplicitlySelected = false
let feedbackController = null

function setCommandHint(message) {
  feedbackController?.setActivePrompt(message)
}

const commandRegistry = window.CaderactCommandRegistry.createRegistry([
  { name: "Line", aliases: ["L"], activate: context => window.caderactViewport.createLineCommandSession(context) },
])
const commandRouter = window.CaderactCommandRouter.createRouter({ registry: commandRegistry, setPrompt: setCommandHint })
window.caderactCommandRegistry = commandRegistry
window.caderactCommandRouter = commandRouter

feedbackController = window.CaderactCommandFeedback.createController({
  setDisplay(message, kind) {
    commandInput.placeholder = message
    commandInput.classList.toggle("has-active-command", message !== "Type a command...")
    commandInput.classList.toggle("has-command-error", kind === "error")
  },
  setHistory(entries) {
    commandHistory.replaceChildren(...entries.map(entry => {
      const row = document.createElement("div")
      row.classList.add("command-history-entry")
      if (entry.kind === "error") row.classList.add("is-error")
      row.textContent = entry.message
      return row
    }))
  },
})
feedbackController.setActivePrompt(commandRouter.currentPrompt)
commandRouter.subscribe(feedbackController.presentResult)
window.caderactFeedback = feedbackController

function getMatchingCommands(value) { return commandRegistry.search(value, { limit: 8 }) }

function appendHighlightedText(parent, text, indices) {
  const matched = new Set(indices)
  for (let index = 0; index < text.length; index++) {
    const node = matched.has(index) ? document.createElement("strong") : document.createElement("span")
    node.textContent = text[index]
    parent.appendChild(node)
  }
}

function createSuggestion(result, index) {
  const button = document.createElement("button")
  button.classList.add("command-suggestion")
  if (index === selectedSuggestionIndex) button.classList.add("is-selected")
  button.type = "button"
  button.dataset.commandIndex = String(index)
  if (result.field === "canonical") appendHighlightedText(button, result.command.name, result.indices)
  else {
    const name = document.createElement("span")
    name.textContent = `${result.command.name} (`
    button.appendChild(name)
    appendHighlightedText(button, result.candidate, result.indices)
    const close = document.createElement("span"); close.textContent = ")"; button.appendChild(close)
  }
  return button
}

function hideSuggestions() {
  commandSuggestions.hidden = true
  commandSuggestions.replaceChildren()
  selectedSuggestionIndex = 0
  suggestionExplicitlySelected = false
}

function showSuggestions() {
  if (commandRouter.isActive) { hideSuggestions(); return [] }
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) { hideSuggestions(); return matches }
  selectedSuggestionIndex = Math.min(selectedSuggestionIndex, matches.length - 1)
  commandSuggestions.replaceChildren(...matches.map(createSuggestion))
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
  } else if (outcome.status === "invalid-input" && outcome.reason === "empty-command") {
    setCommandHint("Type a command...")
  }
  return outcome
}

function confirmSelectedCommand() {
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) return
  commandInput.value = matches[selectedSuggestionIndex].command.name
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

commandInput.addEventListener("input", () => { selectedSuggestionIndex = 0; suggestionExplicitlySelected = false; showSuggestions() })

commandInput.addEventListener("keydown", (event) => {
  const matches = getMatchingCommands(commandInput.value)
  if (commandRouter.isActive && event.key === "Enter") {
    event.preventDefault(); applyCommandResult(commandRouter.finishActive()); resetCommandInput(); return
  }
  if (commandRouter.isActive && event.key === "Escape") {
    event.preventDefault(); applyCommandResult(commandRouter.cancelActive()); resetCommandInput(); return
  }
  if (event.key === "ArrowDown" && matches.length > 0) {
    event.preventDefault(); selectedSuggestionIndex = (selectedSuggestionIndex + 1) % matches.length; suggestionExplicitlySelected = true; showSuggestions()
  } else if (event.key === "ArrowUp" && matches.length > 0) {
    event.preventDefault(); selectedSuggestionIndex = (selectedSuggestionIndex - 1 + matches.length) % matches.length; suggestionExplicitlySelected = true; showSuggestions()
  } else if (event.key === "Tab" && matches.length > 0) {
    event.preventDefault(); confirmSelectedCommand()
  } else if ((event.key === "Enter" || event.key === " ") && commandInput.value.trim() !== "") {
    event.preventDefault()
    if (event.key === "Enter" && suggestionExplicitlySelected && matches[selectedSuggestionIndex]) {
      applyCommandResult(commandRouter.execute(matches[selectedSuggestionIndex].command.name))
    } else runCommandInput()
  }
})

commandSuggestions.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".command-suggestion")
  if (!suggestion || commandRouter.isActive) return
  const matches = getMatchingCommands(commandInput.value)
  selectedSuggestionIndex = Number(suggestion.dataset.commandIndex)
  const selected = matches[selectedSuggestionIndex]
  if (selected) applyCommandResult(commandRouter.execute(selected.command.name))
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
    suggestionExplicitlySelected = false
    showSuggestions()
    event.preventDefault()
  }
})
