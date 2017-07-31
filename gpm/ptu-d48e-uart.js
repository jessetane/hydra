var UartDevice = require('../uart-device')

module.exports = class Gpm extends UartDevice {
  constructor (config) {
    super()
    this.device = config.ptu.device
    this.baudRate = config.ptu.baudRate
  }

  lookAt (latitude, longitude) {
    this.send('KL' + latitude, err => {
      if (err) {
        this.emit('error', err)
        return
      }
      this.send('KO' + longitude, err => {
        if (err) {
          this.emit('error', err)
        }
      })
    })
  }

  set roll (position) {
    this.send('KR' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set pitch (position) {
    this.send('KP' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  set yaw (position) {
    this.send('KH' + position, err => {
      if (err) {
        this.emit('error', err)
      }
    })
  }
}
