var Mouse = require('./')
var Ptu = require('../ptu')

module.exports = class MouseProgram {
  constructor (config) {
    this.onmouseEvent = this.onmouseEvent.bind(this)
    this.running = false
    this.input = new Mouse(config)
    this.output = new Ptu(config)
  }

  start (cb) {
    if (this.running) {
      cb()
      return
    } else {
      this.running = true
    }
    this.input.on('change', this.onmouseEvent)
    this.input.open()
    this.output.open()
  }

  stop () {
    this.running = false
    this.input.removeListener('change', this.onmouseEvent)
    this.input.close()
    this.output.close()
  }

  onmouseEvent (evt) {
    this.output.panOffset = evt.x
    this.output.tiltOffset = evt.y
  }
}
