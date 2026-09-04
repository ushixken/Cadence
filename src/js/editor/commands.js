const commandInput = document.querySelector("#command-input")
const commandSuggestions = document.querySelector("#command-suggestions")
let selectedSuggestionIndex = 0

const commandDefinitions = [
  {
    name: "Line",
    aliases: ["line", "l"],
    execute: () => window.caderactViewport.startLineCommand(),
  },
]

function setCommandHint(message) {
  commandInput.placeholder = message
  commandInput.classList.toggle("has-active-command", message !== "Type a command...")
}

function getMatchingCommands(value) {
  const typedCommand = value.trim().toLowerCase()
  if (typedCommand === "") return []

  return commandDefinitions.filter((command) =>
    [command.name.toLowerCase(), ...command.aliases].some((name) =>
      name.startsWith(typedCommand),
    ),
  )
}

function hideSuggestions() {
  commandSuggestions.hidden = true
  commandSuggestions.innerHTML = ""
  selectedSuggestionIndex = 0
}

function showSuggestions() {
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) {
    hideSuggestions()
    return matches
  }

  selectedSuggestionIndex = Math.min(selectedSuggestionIndex, matches.length - 1)
  commandSuggestions.innerHTML = matches
    .map(
      (command, index) =>
        `<button class="command-suggestion${index === selectedSuggestionIndex ? " is-selected" : ""}" type="button" data-command-index="${index}">${command.name}</button>`,
    )
    .join("")
  commandSuggestions.hidden = false
  return matches
}

function executeCommand(command) {
  command.execute()
  commandInput.value = ""
  commandInput.blur()
  hideSuggestions()
}

function confirmSelectedCommand() {
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length === 0) return

  commandInput.value = matches[selectedSuggestionIndex].name
  hideSuggestions()
}

function runSelectedCommand() {
  const matches = getMatchingCommands(commandInput.value)
  if (matches.length > 0) executeCommand(matches[selectedSuggestionIndex])
}

function resetCommandInput() {
  commandInput.value = ""
  setCommandHint("Type a command...")
  hideSuggestions()
}

function isTypingInAnotherField(target) {
  return (
    target instanceof HTMLElement &&
    target !== commandInput &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  )
}

commandInput.addEventListener("input", () => {
  selectedSuggestionIndex = 0
  showSuggestions()
})

commandInput.addEventListener("keydown", (event) => {
  const matches = getMatchingCommands(commandInput.value)

  if (event.key === "ArrowDown" && matches.length > 0) {
    event.preventDefault()
    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % matches.length
    showSuggestions()
  } else if (event.key === "ArrowUp" && matches.length > 0) {
    event.preventDefault()
    selectedSuggestionIndex = (selectedSuggestionIndex - 1 + matches.length) % matches.length
    showSuggestions()
  } else if (event.key === "Tab" && matches.length > 0) {
    event.preventDefault()
    confirmSelectedCommand()
  } else if ((event.key === "Enter" || event.key === " ") && matches.length > 0) {
    event.preventDefault()
    runSelectedCommand()
  }
})

commandSuggestions.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".command-suggestion")
  if (!suggestion) return

  const matches = getMatchingCommands(commandInput.value)
  selectedSuggestionIndex = Number(suggestion.dataset.commandIndex)
  executeCommand(matches[selectedSuggestionIndex])
})

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    event.target !== commandInput &&
    window.caderactViewport.finishActiveCommand()
  ) {
    event.preventDefault()
    resetCommandInput()
    commandInput.blur()
    return
  }

  if (event.key === "Escape") {
    if (window.caderactViewport.cancelActiveCommand()) {
      event.preventDefault()
      resetCommandInput()
      commandInput.blur()
    } else if (!commandSuggestions.hidden || commandInput.value !== "") {
      event.preventDefault()
      resetCommandInput()
      commandInput.blur()
    }
    return
  }

  const isPrintableKey = event.key.length === 1 && event.code !== "Space"
  if (
    !isPrintableKey ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    isTypingInAnotherField(event.target)
  ) {
    return
  }

  if (event.target !== commandInput) {
    commandInput.focus()
    commandInput.value += event.key
    selectedSuggestionIndex = 0
    showSuggestions()
    event.preventDefault()
  }
})

document.addEventListener("caderact:command-feedback", (event) => {
  setCommandHint(event.detail.message)
})
