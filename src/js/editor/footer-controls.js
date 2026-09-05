const snapTrigger = document.querySelector(".snap-trigger")
const snapMenu = document.querySelector(".snap-menu")
const snapEnabled = document.querySelector("#snap-enabled")
const snapDependentOptions = document.querySelectorAll(".snap-dependent input")
const snapDependentSection = document.querySelector(".snap-dependent")
const footerTools = document.querySelectorAll(".footer-tool")
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

snapEnabled.addEventListener("change", updateSnapOptions)

unitsTrigger.addEventListener("click", () => {
  const isOpening = unitsMenu.hidden
  closeDropdownMenus()
  unitsMenu.hidden = !isOpening
  unitsTrigger.setAttribute("aria-expanded", String(isOpening))
})

unitOptions.forEach((option) => {
  option.addEventListener("click", () => {
    unitOptions.forEach((unitOption) => unitOption.classList.remove("is-selected"))
    option.classList.add("is-selected")
    unitValue.textContent = option.dataset.unit
    closeDropdownMenus()
  })
})

document.addEventListener("click", (event) => {
  if (!event.target.closest(".footer-dropdown")) closeDropdownMenus()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDropdownMenus()
})

updateSnapOptions()

footerTools.forEach(function (button) {
  button.addEventListener("click", function () {
    button.classList.toggle("is-active")
  })
})
