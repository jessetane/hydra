var UartDevice = require('../uart-device')

module.exports = class Ptu extends UartDevice {
  constructor (config) {
    super()
    this.device = config.ptu.device
    this.baudRate = config.ptu.baudRate
  }

  set panOffset (offset) {
    this.send('PO' + offset, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set tiltOffset (offset) {
    this.send('TO' + offset, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }
}
