var I2cDevice = require('../i2c-device')

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
    this.raw = {
      x: 0,
      y: 0,
      z: 0
    }
    this.x = 0
    this.y = 0
    this.z = 0
    this.on('open', () => this.initialize())
  }

  close () {
    this.wire.writeByte(this.address, CTRL_REG1, 0, err => {
      if (err) {
        this.emit('error', new Error('failed to put device to sleep'))
      }
      super.close()
    })
  }

  initialize () {
    // reset
    this.wire.writeByte(this.address, CTRL_REG1, 0b01000000, () => {
      // set gyro full-scale range
      this.wire.writeByte(this.address, CTRL_REG0, CTRL_REG0_FS[this.scaleRange], err => {
        if (err) return this.emit('error', new Error('failed to configure scale range'))
        // set sample rate and put into active mode
        this.wire.writeByte(this.address, CTRL_REG1, CTRL_REG1_DR[this.sampleRate] << 2 | 1 << 1, err => {
          if (err) return this.emit('error', new Error('failed to set sample rate'))
          this.emit('ready')
        })
      })
    })
  }

  read (cb) {
    var buffer = this.sampleBuffer
    var scaleRange = this.scaleRangeRadians
    var int16Scale = 32767
    this.wire.readI2cBlock(this.address, 0x01, 6, buffer, err => {
      if (!err) {
        this.raw.x = buffer.readInt16BE(0)
        this.raw.y = buffer.readInt16BE(2)
        this.raw.z = buffer.readInt16BE(4)
        this.x = this.raw.x / int16Scale * scaleRange
        this.y = this.raw.y / int16Scale * scaleRange
        this.z = this.raw.z / int16Scale * scaleRange
      }
      cb(err)
    })
  }
}
