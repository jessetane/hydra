var Device = require('../device')
var I2cBus = require('i2c-bus')

module.exports = class I2cDevice extends Device {
  constructor (opts) {
    super()
    this.busIndex = opts.busIndex
    if (!this.busIndex) {
      throw new Error('i2c bus index is required')
    }
    this.address = opts.address
    if (!this.address) {
      throw new Error('i2c device address required')
    }
  }

  _open (cb) {
    if (this.bus) return cb()
    // it would be logical to assume you would share a bus instance
    // across devices, but the i2c-bus library doesn't work like that
    // also note below does not actually _access_ the device
    // not sure why it accepts a callback
    this.bus = I2cBus.open(this.busIndex, cb)
  }

  _close (cb) {
    this.bus.close(err => {
      if (!err) {
        delete this.bus
      }
      cb(err)
    })
  }

  watchdog (cb) {
    if (this.state !== 'open') {
      cb(new Error('device unresponsive'))
    } else {
      cb()
    }
  }
}
