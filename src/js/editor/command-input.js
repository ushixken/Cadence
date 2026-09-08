const commandInput = document.querySelector("#command-input")
const viewportCanvas = document.querySelector("canvas")
const commandSuggestions = document.querySelector("#command-suggestions")
const commandHistory = document.querySelector("#command-history")
const commandPrompt = document.querySelector("#command-prompt")
const commandName = document.querySelector("#command-name")
const commandInputWrap = commandInput.closest(".command-input-wrap")
let selectedSuggestionIndex = 0
let suggestionExplicitlySelected = false
let feedbackController = null

function syncCommandInputPresentation() {
  commandInputWrap?.classList.toggle("has-typed-input", commandInput.value.length > 0)
}

function setCommandHint(message, presentation = null) {
  feedbackController?.setActivePrompt(message, commandRouter?.activeSession?.options || [], presentation)
}

const commandRegistry = window.CaderactCommandRegistry.createRegistry([
  { name: "Arc", aliases: ["A"], repeatable: true, activate: context => window.caderactViewport.createArcCommandSession(context) },
  { name: "Circle", aliases: ["C"], repeatable: true, activate: context => window.caderactViewport.createCircleCommandSession(context) },
  { name: "Copy", aliases: ["CP"], repeatable: true, activate: context => window.caderactViewport.createCopyCommandSession(context) },
  { name: "Delete", aliases: ["DEL", "E", "ERASE"], repeatable: true, activate: context => window.caderactViewport.createDeleteCommandSession(context) },
  { name: "Ellipse", aliases: ["EL"], repeatable: true, activate: context => window.caderactViewport.createEllipseCommandSession(context) },
  { name: "Extend", aliases: ["EX"], repeatable: true, activate: context => window.caderactViewport.createExtendCommandSession(context) },
  { name: "Line", aliases: ["L"], repeatable: true, activate: context => window.caderactViewport.createLineCommandSession(context) },
  { name: "Move", aliases: ["M"], repeatable: true, activate: context => window.caderactViewport.createMoveCommandSession(context) },
  { name: "Polyline", aliases: ["Pline", "PL"], priority: 10, repeatable: true, activate: context => window.caderactViewport.createPolylineCommandSession(context) },
  { name: "Polygon", aliases: ["PG"], repeatable: true, activate: context => window.caderactViewport.createPolygonCommandSession(context) },
  { name: "Rectangle", aliases: ["Rect"], repeatable: true, activate: context => window.caderactViewport.createRectangleCommandSession(context) },
  { name: "Rotate", aliases: ["RO"], repeatable: true, activate: context => window.caderactViewport.createRotateCommandSession(context) },
  { name: "Scale", aliases: ["SC"], repeatable: true, activate: context => window.caderactViewport.createScaleCommandSession(context) },
  { name: "Trim", aliases: ["TR"], repeatable: true, activate: context => window.caderactViewport.createTrimCommandSession(context) },
])
const commandRouter = window.CaderactCommandRouter.createRouter({ registry: commandRegistry, setPrompt: setCommandHint })
window.caderactCommandRegistry = commandRegistry
window.caderactCommandRouter = commandRouter

feedbackController = window.CaderactCommandFeedback.createController({
  setDisplay(message, kind, options, presentation) {
    const active = message !== "Type a command..."
    commandName.textContent = active && presentation?.commandName ? `${presentation.commandName}:` : ""
    commandPrompt.replaceChildren()
    if (active) {
      if (presentation?.instruction) {
        const instruction = document.createElement("span"); instruction.classList.add("command-prompt-instruction"); instruction.textContent = presentation.instruction
        commandPrompt.appendChild(instruction)
      } else {
        const text = document.createElement("span"); text.classList.add("command-prompt-text"); text.textContent = message
        commandPrompt.appendChild(text)
      }
      for (const option of options) {
        const button=document.createElement("button");button.type="button";button.classList.add("command-option")
        button.dataset.optionId=option.id;button.textContent=option.showValue===false?option.label:`${option.label}=${option.value}`;button.disabled=option.enabled===false
        button.setAttribute("aria-label",option.showValue===false?option.label:`${option.label}, current value ${option.value}`);commandPrompt.appendChild(button)
      }
    }
    commandInput.placeholder = active ? "" : "Type a command..."
    commandPrompt.classList.toggle("is-error", kind === "error")
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
feedbackController.setActivePrompt(commandRouter.currentPrompt, [], commandRouter.currentPromptPresentation)
commandRouter.subscribe(feedbackController.presentResult)
commandRouter.subscribe(() => window.caderactViewport.setCommandActive(commandRouter.isActive))
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
    syncCommandInputPresentation()
    commandInput.blur()
    hideSuggestions()
  } else if (outcome.status === "unknown-command") {
    commandInput.value = ""
    syncCommandInputPresentation()
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
  syncCommandInputPresentation()
  hideSuggestions()
}

function runCommandInput() { return applyCommandResult(commandRouter.execute(commandInput.value)) }

function acceptIdleCommandSuggestion() {
  if (commandRouter.isActive || commandInput.value.trim() === "") return false
  const matches = getMatchingCommands(commandInput.value)
  const selected = matches[selectedSuggestionIndex]
  if (selected && (suggestionExplicitlySelected || selected.category < 6)) {
    applyCommandResult(commandRouter.execute(selected.command.name))
  } else runCommandInput()
  return true
}

function submitActiveCommandInput() {
  if (!commandRouter.isActive) return false
  if (commandInput.value.trim() !== "") {
    const outcome = commandRouter.submitActiveInput(commandInput.value)
    commandInput.value = ""; syncCommandInputPresentation(); hideSuggestions()
    if (outcome.status === "command-completed") commandInput.blur()
  } else if (commandRouter.activeSession?.acceptsEmptyInput) {
    const outcome = commandRouter.submitActiveInput("")
    commandInput.value = ""; syncCommandInputPresentation(); hideSuggestions()
    if (outcome.status === "command-completed") commandInput.blur()
  } else {
    applyCommandResult(commandRouter.finishActive()); resetCommandInput()
  }
  return true
}

function submitCurrentInput() {
  return commandRouter.isActive ? submitActiveCommandInput() : acceptIdleCommandSuggestion()
}

window.caderactCommandInput = Object.freeze({ acceptIdleCommandSuggestion, submitCurrentInput })

function resetCommandInput() {
  commandInput.value = ""
  syncCommandInputPresentation()
  setCommandHint(commandRouter.currentPrompt)
  hideSuggestions()
}

commandPrompt.addEventListener("click", event => {
  const button=event.target.closest(".command-option")
  if(!button||button.disabled||!commandRouter.isActive)return
  commandRouter.activateOption(button.dataset.optionId)
  commandInput.value="";syncCommandInputPresentation();hideSuggestions();commandInput.focus()
})

commandInputWrap?.addEventListener("click", event => {
  if (event.target.closest?.(".command-option")) return
  commandInput.focus()
})

function isTypingInAnotherField(target) {
  return target instanceof HTMLElement && target !== commandInput &&
    (target.matches("input, textarea, select") || target.isContentEditable)
}

commandInput.addEventListener("input", () => {
  syncCommandInputPresentation()
  selectedSuggestionIndex = 0; suggestionExplicitlySelected = false; showSuggestions()
})

commandInput.addEventListener("keydown", (event) => {
  const matches = getMatchingCommands(commandInput.value)
  if (commandRouter.isActive && event.key === "Enter") {
    event.preventDefault()
    submitCurrentInput()
    return
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
  } else if (event.key === "Enter" && !commandRouter.isActive && commandInput.value.trim() !== "") {
    event.preventDefault()
    submitCurrentInput()
  } else if (event.key === "Enter" && !commandRouter.isActive && commandInput.value.trim() === "") {
    if (window.caderactSelection?.selectedIds().length > 0) {
      event.preventDefault()
      window.caderactSelection.clear()
    }
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
  if (event.caderactSelectionBoxHandled) return
  if (event.key === "Escape" && window.caderactGrips?.isActive) {
    window.caderactViewport.cancelGripEdit(); event.preventDefault(); return
  }
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
    } else if (window.caderactSelection?.selectedIds().length > 0) {
      event.preventDefault()
      window.caderactSelection.clear()
    }
    return
  }
  if (event.key === "Enter" && event.target !== commandInput) {
    if (!commandRouter.isActive && !isTypingInAnotherField(event.target)) {
      if (window.caderactSelection?.selectedIds().length > 0) {
        event.preventDefault()
        window.caderactSelection.clear()
        return
      }
    }
  }

  if ((event.key === "Delete" || event.key === "Backspace")
    && event.target !== commandInput && !isTypingInAnotherField(event.target)
    && !commandRouter.isActive && !window.caderactGrips?.isActive
    && window.caderactSelection?.selectedIds().length > 0) {
    event.preventDefault()
    applyCommandResult(commandRouter.execute("Delete"))
    applyCommandResult(commandRouter.finishActive())
    resetCommandInput()
    return
  }

  const isPrintableKey = event.key.length === 1 && event.code !== "Space"
  const activeAcceptsInput = commandRouter.isActive && typeof commandRouter.activeSession?.handleInput === "function"
  if (!isPrintableKey || (commandRouter.isActive && !activeAcceptsInput) || event.ctrlKey || event.altKey || event.metaKey || isTypingInAnotherField(event.target)) return
  if (event.target !== commandInput) {
    commandInput.focus()
    commandInput.value += event.key
    syncCommandInputPresentation()
    selectedSuggestionIndex = 0
    suggestionExplicitlySelected = false
    showSuggestions()
    event.preventDefault()
  }
})
