// @ts-check

/** @param {string} selector @returns {HTMLElement} */
function requiredElement(selector) {
  const element = document.querySelector(selector)
  if (!(element instanceof HTMLElement)) throw new Error(`Required element not found: ${selector}`)
  return element
}

/** @param {string} selector @returns {HTMLInputElement} */
function requiredInput(selector) {
  return /** @type {HTMLInputElement} */ (requiredElement(selector))
}

/** @param {string} selector @returns {HTMLCanvasElement} */
function requiredCanvas(selector) {
  return /** @type {HTMLCanvasElement} */ (requiredElement(selector))
}

/** @param {EventTarget | null} target @returns {HTMLElement | null} */
function eventElement(target) { return target instanceof HTMLElement ? target : null }

const commandInput = requiredInput("#command-input")
const viewportCanvas = requiredCanvas("canvas")
const commandSuggestions = requiredElement("#command-suggestions")
const commandHistory = requiredElement("#command-history")
const commandPrompt = requiredElement("#command-prompt")
const commandName = requiredElement("#command-name")
const commandInputWrap = commandInput.closest(".command-input-wrap")
if (!(commandInputWrap instanceof HTMLElement)) throw new Error("Required element not found: .command-input-wrap")
let selectedSuggestionIndex = 0
let suggestionExplicitlySelected = false
/** @type {CaderactCommandFeedbackController | null} */
let feedbackController = null
/** @type {CaderactCommandRouter} */
let commandRouter

function syncCommandInputPresentation() {
  commandInputWrap?.classList.toggle("has-typed-input", commandInput.value.length > 0)
}

/** @param {string} message @param {CaderactPromptPresentation | null} [presentation] */
function setCommandHint(message, presentation = null) {
  feedbackController?.setActivePrompt(message, commandRouter?.activeSession?.options || [], presentation)
}

const commandRegistry = window.CaderactCommandRegistry.createRegistry([
  { name: "Aligned", aliases: ["DIMALIGNED", "DAL"], repeatable: true, activate: context => window.caderactViewport.createAlignedDimensionCommandSession(context) },
  { name: "Angular", aliases: ["DIMANGULAR", "DAN"], repeatable: true, activate: context => window.caderactViewport.createAngularDimensionCommandSession(context) },
  { name: "Arc", aliases: ["A"], repeatable: true, activate: context => window.caderactViewport.createArcCommandSession(context) },
  { name: "Angle", aliases: ["ANG"], repeatable: true, activate: context => window.caderactViewport.createAngleMeasurementCommandSession(context) },
  { name: "Area", aliases: [], repeatable: true, activate: context => window.caderactViewport.createObjectMeasurementCommandSession("Area", context) },
  { name: "Block", aliases: ["B"], repeatable: true, activate: context => window.caderactViewport.createBlockCommandSession(context) },
  { name: "BlockEdit", aliases: ["BE"], repeatable: true, activate: context => window.caderactViewport.createBlockEditCommandSession(context) },
  { name: "Circle", aliases: ["C"], repeatable: true, activate: context => window.caderactViewport.createCircleCommandSession(context) },
  { name: "Linear", aliases: ["DIMLINEAR", "DLI"], repeatable: true, activate: context => window.caderactViewport.createLinearDimensionCommandSession(context) },
  { name: "Copy", aliases: ["CP"], repeatable: true, activate: context => window.caderactViewport.createCopyCommandSession(context) },
  { name: "Delete", aliases: ["DEL", "E", "ERASE"], repeatable: true, activate: context => window.caderactViewport.createDeleteCommandSession(context) },
  { name: "Distance", aliases: ["DI", "DIST"], repeatable: true, activate: context => window.caderactViewport.createDistanceCommandSession(context) },
  { name: "DistanceObject", aliases: ["DOBJ"], repeatable: true, activate: context => window.caderactViewport.createDistanceObjectCommandSession(context) },
  { name: "DistanceSum", aliases: ["DSUM"], repeatable: true, activate: context => window.caderactViewport.createDistanceSumCommandSession(context) },
  { name: "DimDiameter", aliases: ["DDI"], repeatable: true, activate: context => window.caderactViewport.createRadialDimensionCommandSession("DimDiameter", "diameter", context) },
  { name: "DimRadius", aliases: ["DRA"], repeatable: true, activate: context => window.caderactViewport.createRadialDimensionCommandSession("DimRadius", "radius", context) },
  { name: "Ellipse", aliases: ["EL"], repeatable: true, activate: context => window.caderactViewport.createEllipseCommandSession(context) },
  { name: "Extend", aliases: ["EX"], repeatable: true, activate: context => window.caderactViewport.createExtendCommandSession(context) },
  { name: "Hatch", aliases: ["H"], repeatable: true, activate: context => window.caderactViewport.createHatchCommandSession(context) },
  { name: "Insert", aliases: ["I"], repeatable: true, activate: context => window.caderactViewport.createInsertCommandSession(context) },
  { name: "Line", aliases: ["L"], repeatable: true, activate: context => window.caderactViewport.createLineCommandSession(context) },
  { name: "Length", aliases: ["LEN"], repeatable: true, activate: context => window.caderactViewport.createObjectMeasurementCommandSession("Length", context) },
  { name: "Move", aliases: ["M"], repeatable: true, activate: context => window.caderactViewport.createMoveCommandSession(context) },
  { name: "Mirror", aliases: ["MI"], repeatable: true, activate: context => window.caderactViewport.createMirrorCommandSession(context) },
  { name: "MinDist", aliases: [], repeatable: true, activate: context => window.caderactViewport.createMinDistanceCommandSession(context) },
  { name: "Offset", aliases: ["O"], repeatable: true, activate: context => window.caderactViewport.createOffsetCommandSession(context) },
  { name: "Perimeter", aliases: ["PERIM"], repeatable: true, activate: context => window.caderactViewport.createObjectMeasurementCommandSession("Perimeter", context) },
  { name: "Polyline", aliases: ["Pline", "PL"], priority: 10, repeatable: true, activate: context => window.caderactViewport.createPolylineCommandSession(context) },
  { name: "Polygon", aliases: ["PG"], repeatable: true, activate: context => window.caderactViewport.createPolygonCommandSession(context) },
  { name: "Rectangle", aliases: ["Rect"], repeatable: true, activate: context => window.caderactViewport.createRectangleCommandSession(context) },
  { name: "Region", aliases: ["REG"], repeatable: true, activate: context => window.caderactViewport.createRegionCommandSession(context) },
  { name: "Radius", aliases: ["RAD"], repeatable: true, activate: context => window.caderactViewport.createObjectMeasurementCommandSession("Radius", context) },
  { name: "Rotate", aliases: ["RO"], repeatable: true, activate: context => window.caderactViewport.createRotateCommandSession(context) },
  { name: "Scale", aliases: ["SC"], repeatable: true, activate: context => window.caderactViewport.createScaleCommandSession(context) },
  { name: "Diameter", aliases: ["DIA"], repeatable: true, activate: context => window.caderactViewport.createObjectMeasurementCommandSession("Diameter", context) },
  { name: "Trim", aliases: ["TR"], repeatable: true, activate: context => window.caderactViewport.createTrimCommandSession(context) },
  { name: "Text", aliases: ["DTEXT"], repeatable: true, activate: context => window.caderactViewport.createTextCommandSession(context) },
  ...window.caderactCadCommands.definitions(),
])
commandRouter = window.CaderactCommandRouter.createRouter({ registry: commandRegistry, setPrompt: setCommandHint,
  getPreselectionIds: () => window.caderactSelection?.selectedIds?.() || [] })
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

/** @param {string} value */
function getMatchingCommands(value) { return commandRegistry.search(value, { limit: 8 }) }

/** @param {HTMLElement} parent @param {string} text @param {readonly number[]} indices */
function appendHighlightedText(parent, text, indices) {
  const matched = new Set(indices)
  for (let index = 0; index < text.length; index++) {
    const node = matched.has(index) ? document.createElement("strong") : document.createElement("span")
    node.textContent = text[index]
    parent.appendChild(node)
  }
}

/** @param {CaderactCommandMatch} result @param {number} index */
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

/** @param {CaderactCommandOutcome} outcome */
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
    const submittedValue = commandInput.value
    const outcome = commandRouter.submitActiveInput(submittedValue)
    if (outcome.status === "invalid-input") {
      commandInput.value = submittedValue
      commandInput.setAttribute("aria-invalid", "true")
      commandInput.focus()
    } else {
      commandInput.value = ""
      commandInput.setAttribute("aria-invalid", "false")
    }
    syncCommandInputPresentation(); hideSuggestions()
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
  commandInput.setAttribute("aria-invalid", "false")
  syncCommandInputPresentation()
  setCommandHint(commandRouter.currentPrompt)
  hideSuggestions()
}

commandPrompt.addEventListener("click", event => {
  const button=eventElement(event.target)?.closest(".command-option")
  if (!(button instanceof HTMLElement)) return
  const optionButton = /** @type {HTMLButtonElement} */ (button)
  if(optionButton.disabled||!commandRouter.isActive)return
  commandRouter.activateOption(optionButton.dataset.optionId)
  commandInput.value="";syncCommandInputPresentation();hideSuggestions();commandInput.focus()
})

commandInputWrap.addEventListener("click", event => {
  if (eventElement(event.target)?.closest(".command-option")) return
  window.caderactViewport.cancelDynamicInputEdit?.()
  commandInput.focus()
})
commandInput.addEventListener("focus", () => window.caderactViewport.cancelDynamicInputEdit?.())

/** @param {EventTarget | null} target */
function isTypingInAnotherField(target) {
  return target instanceof HTMLElement && target !== commandInput &&
    (target.matches("input, textarea, select") || target.isContentEditable)
}

function hasSelection() { return (window.caderactSelection?.selectedIds().length || 0) > 0 }

function clearSelection() { window.caderactSelection?.clear() }

commandInput.addEventListener("input", () => {
  commandInput.setAttribute("aria-invalid", "false")
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
    if (hasSelection()) {
      event.preventDefault()
      clearSelection()
    }
  }
})

commandSuggestions.addEventListener("click", (event) => {
  const suggestion = eventElement(event.target)?.closest(".command-suggestion")
  if (!(suggestion instanceof HTMLElement) || commandRouter.isActive) return
  const matches = getMatchingCommands(commandInput.value)
  selectedSuggestionIndex = Number(suggestion.dataset.commandIndex)
  const selected = matches[selectedSuggestionIndex]
  if (selected) applyCommandResult(commandRouter.execute(selected.command.name))
})

document.addEventListener("keydown", (event) => {
  if (event.caderactDynamicInputHandled) return
  if (event.caderactSelectionBoxHandled) return
  const primaryModifier = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey)
  const editableTarget = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable)
  if (primaryModifier && event.key.toLowerCase() === "a" && !editableTarget && !commandRouter.isActive && !window.caderactGrips?.isActive) {
    const outcome = window.caderactViewport.selectAllCommittedGeometry()
    if (outcome.status !== "selection-busy") event.preventDefault()
    return
  }
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
    } else if (hasSelection()) {
      event.preventDefault()
      clearSelection()
    }
    return
  }
  if (event.key === "Enter" && event.target !== commandInput) {
    if (!commandRouter.isActive && !isTypingInAnotherField(event.target)) {
      if (hasSelection()) {
        event.preventDefault()
        clearSelection()
        return
      }
    }
  }

  if ((event.key === "Delete" || event.key === "Backspace")
    && event.target !== commandInput && !isTypingInAnotherField(event.target)
    && !commandRouter.isActive && !window.caderactGrips?.isActive
    && hasSelection()) {
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
