var UartDevice = require('../device-uart')

module.exports = class Ptu extends UartDevice {
  constructor (config) {
    super({
      device: config.ptu.device,
      baudRate: config.ptu.baudRate
    })
    // really wish es6 had syntax for this
    Object.getOwnPropertyNames(this.constructor.prototype).forEach(method => {
      if (method !== 'constructor') {
        this[method] = this[method].bind(this)
      }
    })
  }

  setPanOffset (offset, cb) {
    this.send('PO' + offset, 'PO', cb)
  }

  setTiltOffset (offset, cb) {
    this.send('TO' + offset, 'TO', cb)
  }

  setPanTiltOffset (panOffset, tiltOffset, cb) {
    this.setPanOffset(panOffset, err => {
      if (err) return cb(err)
      this.setTiltOffset(tiltOffset, cb)
    })
  }

  setRoll (roll, cb) {
    this.send('KR' + roll, 'KR', cb)
  }

  setPitch (pitch, cb) {
    this.send('KP' + pitch, 'KP', cb)
  }

  setYaw (yaw, cb) {
    this.send('KH' + yaw, 'KH', cb)
  }

  setLatitude (latitude, cb) {
    this.send('KL' + latitude, 'KL', cb)
  }

  setLongitude (longitude, cb) {
    this.send('KO' + longitude, 'KO', cb)
  }

  setAltitude (altitude, cb) {
    this.send('KA' + altitude, 'KA', cb)
  }

  lookAt (target, cb) {
    this.send(`KG${target.latitude},${target.longitude},${target.altitude},${target.altitude}`, 'KG', cb)
  }
}
