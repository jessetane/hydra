var UartDevice = require('../uart-device')

module.exports = class Gpm extends UartDevice {
  constructor (config) {
    super()
    this.device = config.ptu.device
    this.baudRate = config.ptu.baudRate
  }

  lookAt (latitude, longitude) {
    this.execute('KL' + latitude, err => {
      if (err) {
        this.emit('error', err)
      }
      this.execute('KO' + longitude, err => {
        if (err) {
          this.emit('error', err)
        }
      })
    })
  }

  set roll (position) {
    this.execute('KR' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set pitch (position) {
    this.execute('KP' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set yaw (position) {
    this.execute('KH' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }
}
