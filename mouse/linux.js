var Emitter = require('events')
var fs = require('fs')

module.exports = class Mouse extends Emitter {
  constructor (config) {
    super()
    this.device = config.mouse.device
    this.buffer = new Buffer(8)
  }

  open () {
    this.ensureOpenInterval = setInterval(() => {
      if (!this.input && !this.opening) {
        this._open()
      }
    }, 1000)
    this._open()
  }

  _open () {
    this.opening = true
    fs.open(this.device, 'r', (err, fd) => {
      this.opening = false
      if (err) {
        this.emit('error', err)
      } else {
        this.input = fd
        this.poll()
      }
    })
  }

  poll () {
    fs.read(this.input, this.buffer, 0, 8, null, err => {
      if (err) {
        if (this.input) {
          this.emit('error', err)
          this.input = null
          this._open()
        }
        return
      }
      var x = this.buffer.readInt8(1)
      var y = this.buffer.readInt8(2)
      var buttons = this.buffer[0]
      buttons = {
        left: buttons & 0x1,
        middle: buttons & 0x4,
        right: buttons & 0x2
      }
      this.emit('change', { x, y, buttons })
      this.poll()
    })
  }

  close () {
    clearInterval(this.ensureOpenInterval)
    var input = this.input
    this.input = null
    fs.close(input)
  }
}
