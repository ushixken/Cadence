// ME5: compact, router-owned measurement command discoverability.
(() => {
  const menu = document.querySelector(".tools-menu")
  const trigger = document.querySelector(".tools-menu-trigger")
  const dropdown = document.querySelector("#measure-menu-actions")
  if (!menu || !trigger || !dropdown || !window.caderactCommandRouter) return
  const items = Array.from(dropdown.querySelectorAll("[data-measure-command]"))

  function setOpen(open, { focus = false } = {}) {
    menu.classList.toggle("is-open", open)
    dropdown.hidden = !open
    trigger.setAttribute("aria-expanded", String(open))
    if (focus && open) items[0]?.focus()
  }

  trigger.addEventListener("click", () => setOpen(dropdown.hidden, { focus: dropdown.hidden }))
  dropdown.addEventListener("click", event => {
    const item = event.target.closest?.("[data-measure-command]")
    if (!item) return
    const command = item.dataset.measureCommand
    setOpen(false)
    if (command) window.caderactCommandRouter.execute(command)
  })
  dropdown.addEventListener("keydown", event => {
    if (event.key === "Escape") { setOpen(false); trigger.focus(); event.preventDefault(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const current = Math.max(0, items.indexOf(document.activeElement))
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
    event.preventDefault()
  })
  document.addEventListener("click", event => { if (!menu.contains(event.target)) setOpen(false) })
})()
