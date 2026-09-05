// A11: narrow ownership boundary for replacing a context-locked render canvas.
(() => {
  function createOwner(initialCanvas) {
    if (!initialCanvas || typeof initialCanvas.cloneNode !== "function" || typeof initialCanvas.replaceWith !== "function") {
      throw new Error("Viewport canvas cannot be replaced")
    }
    let canvas = initialCanvas
    let replacementCount = 0
    function replace() {
      const previous = canvas
      const replacement = previous.cloneNode(false)
      replacement.width = previous.width
      replacement.height = previous.height
      previous.replaceWith(replacement)
      canvas = replacement
      replacementCount += 1
      return replacement
    }
    return Object.freeze({
      replace,
      get current() { return canvas },
      get replacementCount() { return replacementCount },
    })
  }
  window.CaderactViewportCanvas = Object.freeze({ createOwner })
})()
