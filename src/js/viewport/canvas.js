const canvas = document.querySelector("canvas")
const ctx = canvas.getContext("2d")

const gridSpacing = 50

canvas.height = canvas.clientHeight * devicePixelRatio
canvas.width = canvas.clientWidth * devicePixelRatio


ctx.strokeStyle = "white"

for (let y = gridSpacing; y <= canvas.height ; y = y + gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
}

for (let x = gridSpacing; x <= canvas.width ; x = x + gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
}
