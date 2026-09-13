const snapTrigger = document.querySelector(".snap-trigger")
const snapMenu = document.querySelector(".snap-menu")
const snapEnabled = document.querySelector("#snap-enabled")
const snapDependentOptions = document.querySelectorAll(".snap-dependent input")
const snapModeOptions = document.querySelectorAll("[data-snap-mode]")
const snapDependentSection = document.querySelector(".snap-dependent")
const footerTools = document.querySelectorAll(".footer-tool")
const gridSnapToggle = document.querySelector("#grid-snap-toggle")
const orthoToggle = document.querySelector("#ortho-toggle")
const polarToggle = document.querySelector("#polar-toggle")
const trackToggle = document.querySelector("#track-toggle")
const unitsTrigger = document.querySelector(".units-control")
const unitsMenu = document.querySelector(".units-menu")
const unitValue = document.querySelector("[data-unit-value]")
const unitOptions = document.querySelectorAll(".unit-option")

function updateSnapOptions() {
  const isSnapEnabled = snapEnabled.checked
  snapDependentOptions.forEach((option) => {
    option.disabled = !isSnapEnabled
  })
  snapDependentSection.classList.toggle("is-disabled", !isSnapEnabled)
}

function closeDropdownMenus() {
  snapMenu.hidden = true
  snapTrigger.setAttribute("aria-expanded", "false")
  unitsMenu.hidden = true
  unitsTrigger.setAttribute("aria-expanded", "false")
}

snapTrigger.addEventListener("click", () => {
  const isOpening = snapMenu.hidden
  closeDropdownMenus()
  snapMenu.hidden = !isOpening
  snapTrigger.setAttribute("aria-expanded", String(isOpening))
})

snapEnabled.addEventListener("change", () => window.caderactViewport.setObjectSnapMode("object", snapEnabled.checked))
snapModeOptions.forEach(option => option.addEventListener("change", () => window.caderactViewport.setObjectSnapMode(option.dataset.snapMode, option.checked)))

unitsTrigger.addEventListener("click", () => {
  const isOpening = unitsMenu.hidden
  closeDropdownMenus()
  unitsMenu.hidden = !isOpening
  unitsTrigger.setAttribute("aria-expanded", String(isOpening))
})

unitOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const outcome = window.caderactDocumentSession.unitGateway.setLengthUnit(option.dataset.unit)
    if (outcome.status === "committed" || outcome.status === "no-op") window.caderactViewport.refreshDocumentView()
    closeDropdownMenus()
  })
})

let unsubscribeUnitHistory = null
function refreshUnitControl() {
  const activeUnit = window.caderactDocumentSession.reader.units().length
  unitValue.textContent = activeUnit
  unitOptions.forEach(option => {
    const selected = option.dataset.unit === activeUnit
    option.classList.toggle("is-selected", selected)
    option.setAttribute("aria-checked", String(selected))
  })
  window.caderactViewport.refreshDocumentView()
}
function bindUnitDocument() {
  unsubscribeUnitHistory?.()
  unsubscribeUnitHistory = window.caderactDocumentSession.controller.subscribeHistory(refreshUnitControl)
}
bindUnitDocument()
window.caderactDocumentSession.subscribe(bindUnitDocument)

document.addEventListener("click", (event) => {
  if (!event.target.closest(".footer-dropdown")) closeDropdownMenus()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDropdownMenus()
})

updateSnapOptions()

function refreshGridSnapButton(modes) {
  gridSnapToggle.classList.toggle("is-active", modes.grid)
  gridSnapToggle.setAttribute("aria-pressed", String(modes.grid))
}
gridSnapToggle.addEventListener("mousedown", event => event.preventDefault())
gridSnapToggle.addEventListener("click", () => window.caderactViewport.setGridSnapEnabled(!window.caderactViewport.snapModes.grid))
window.caderactViewport.subscribeSnapModes(refreshGridSnapButton)
window.caderactViewport.subscribeSnapModes(modes => { snapModeOptions.forEach(option => { option.checked=Boolean(modes[option.dataset.snapMode]); option.disabled=option.dataset.snapMode!=="object"&&!modes.object }); updateSnapOptions() })
orthoToggle?.addEventListener("mousedown", event => event.preventDefault())
orthoToggle?.addEventListener("click", () => window.caderactViewport.setOrthoEnabled(!window.caderactViewport.orthoEnabled))
if (orthoToggle) window.caderactViewport.subscribeEffectiveOrtho?.(enabled => { orthoToggle.classList.toggle("is-active", enabled); orthoToggle.setAttribute("aria-pressed", String(enabled)) })
polarToggle?.addEventListener("mousedown", event => event.preventDefault())
polarToggle?.addEventListener("click", () => window.caderactViewport.setPolarEnabled(!window.caderactViewport.polarEnabled))
if (polarToggle) window.caderactViewport.subscribeEffectivePolar?.(enabled => { polarToggle.classList.toggle("is-active", enabled); polarToggle.setAttribute("aria-pressed", String(enabled)) })
trackToggle?.addEventListener("mousedown", event => event.preventDefault())
trackToggle?.addEventListener("click", () => window.caderactViewport.setObjectSnapTrackingEnabled(!window.caderactViewport.objectSnapTrackingEnabled))
if (trackToggle) window.caderactViewport.subscribeObjectSnapTracking?.(enabled => { trackToggle.classList.toggle("is-active", enabled); trackToggle.setAttribute("aria-pressed", String(enabled)) })

footerTools.forEach(function (button) {
  if (button === gridSnapToggle || button === orthoToggle || button === polarToggle || button === trackToggle) return
  button.addEventListener("click", function () {
    button.classList.toggle("is-active")
  })
})
