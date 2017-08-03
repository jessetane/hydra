var I2cDevice = require('../device-i2c')
var Queue = require('queue')

// docs (gyroscope)
// http://www.nxp.com/docs/en/data-sheet/FXAS21002.pdf
// https://github.com/adafruit/Adafruit_FXAS21002C

var CTRL_REG0 = 0x0d
var CTRL_REG1 = 0x13

var CTRL_REG0_FS = { // full scale range in degrees / second
  '2000': 0,
  '1000': 1,
  '500': 2,
  '250': 3
}

var CTRL_REG1_DR = { // sample rate in Hz
  '800': 0,
  '400': 1,
  '200': 2,
  '100': 3,
  '50': 4,
  '25': 5,
  '12.5': 6
}

module.exports = class Fxas21002c extends I2cDevice {
  constructor (config) {
    super({
      busIndex: config.imu.device.split('-')[1],
      address: config.imu.gyroscopeAddress || 0x21
    })
    this.scaleRange = parseInt(config.imu.gyroscopeScaleRange || 2000, 10)
    this.scaleRangeRadians = this.scaleRange / 360 * Math.PI * 2
    this.sampleRate = parseInt(config.imu.gyroscopeSampleRate || 200, 10)
    this.sampleBuffer = new Buffer(6)
    this.gyroscope = {
      raw: {
        x: 0,
        y: 0,
        z: 0
      },
      x: 0,
      y: 0,
      z: 0
    }
  }

  _open (cb) {
    super._open(() => {
      var q = new Queue({ concurrency: 1 })
      // reset
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG1, 0b01000000, () => cb()))
      // set gyro full-scale range
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG0, CTRL_REG0_FS[this.scaleRange], cb))
      // set sample rate and put into active mode
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG1, CTRL_REG1_DR[this.sampleRate] << 2 | 1 << 1, cb))
      q.start(cb)
    })
  }

  _close (cb) {
    this.bus.writeByte(this.address, CTRL_REG1, 0, err => {
      super._close(err2 => {
        if (err && err2) {
          err = [err, err2]
        } else if (err2) {
          err = err2
        }
        cb(err)
      })
    })
  }

  read (cb) {
    var buffer = this.sampleBuffer
    var scaleRange = this.scaleRangeRadians
    var int16Scale = 32767
    this.bus.readI2cBlock(this.address, 0x01, 6, buffer, err => {
      if (err) return cb(err)
      this.gyroscope.raw.x = buffer.readInt16BE(0)
      this.gyroscope.raw.y = buffer.readInt16BE(2)
      this.gyroscope.raw.z = buffer.readInt16BE(4)
      this.gyroscope.x = this.gyroscope.raw.x / int16Scale * scaleRange
      this.gyroscope.y = this.gyroscope.raw.y / int16Scale * scaleRange
      this.gyroscope.z = this.gyroscope.raw.z / int16Scale * scaleRange
      cb()
    })
  }
}
