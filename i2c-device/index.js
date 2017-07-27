var Emitter = require('events')
var I2cBus = require('i2c-bus')

module.exports = class I2cDevice extends Emitter {
  constructor (opts) {
    super()
    this.busIndex = opts.busIndex
    this.address = opts.address
  }

  open () {
    this.ensureOpenInterval = setInterval(() => {
      if (!this.wire && !this.opening) {
        this._open()
      }
    }, 1000)
    this._open()
  }

  _open () {
    this.opening = true
    var wire = I2cBus.open(this.busIndex, err => {
      this.opening = true
      if (err) {
        this.emit('error', err)
      } else {
        this.wire = wire
        this.emit('open')
      }
    })
  }

  close () {
    clearInterval(this.ensureOpenInterval)
    var wire = this.wire
    this.wire = null
    wire.close(err => {})
    this.emit('close')
  }
}
