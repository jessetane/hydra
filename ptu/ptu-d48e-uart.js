var UartDevice = require('../uart-device')

module.exports = class Ptu extends UartDevice {
  constructor (config) {
    super()
    this.device = config.ptu.device
    this.baudRate = config.ptu.baudRate
  }

  set panOffset (offset) {
    this.execute('PO' + offset, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set tiltOffset (offset) {
    this.execute('TO' + offset, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }
}
