var I2cDevice = require('../device-i2c')
var Queue = require('queue')

// docs (accelerometer + magnetometer)
// http://cache.nxp.com/docs/en/data-sheet/FXOS8700CQ.pdf
// https://github.com/adafruit/Adafruit_FXOS8700/blob/master/Adafruit_FXOS8700.cpp

var XYZ_DATA_CFG = 0xe
var XYZ_DATA_CFG_FS = { // acclerometer scale range in earth g's
  '2': 0,
  '4': 1,
  '8': 2
}

var CTRL_REG1 = 0x2a
var CTRL_REG1_DR = { // sample rate in Hz
  '400': 0,
  '200': 1,
  '100': 2,
  '50': 3,
  '25': 4,
  '6.25': 5
}

var CTRL_REG2 = 0x2b
var M_CTRL_REG1 = 0x5b
var M_CTRL_REG2 = 0x5c

var M_OFF_X_MSB = 0x3F

module.exports = class Fxos8700cq extends I2cDevice {
  constructor (config) {
    super({
      busIndex: config.imu.device.split('-')[1],
      address: config.imu.accelerometerAddress || 0x1f
    })
    this.magnetometerOffset = config.imu.magnetometerOffset
    this.accelerometerScaleRange = parseInt(config.imu.accelerometerScaleRange || 8, 10)
    this.sampleRate = parseInt(config.imu.accelerometerSampleRate || 400, 10)
    this.sampleBuffer = new Buffer(12)
    this.accelerometer = {
      raw: {
        x: 0,
        y: 0,
        z: 0
      },
      x: 0,
      y: 0,
      z: 0
    }
    this.magnetometer = {
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
      // reset - note device needs a short delay to finish resetting
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG2, 0b01000000, () => setTimeout(cb, 10)))
      // configure accelerometer scale range
      q.push(cb => this.bus.writeByte(this.address, XYZ_DATA_CFG, XYZ_DATA_CFG_FS[this.accelerometerScaleRange], cb))
      // jump to magnetometer registers after reading accelerometer registers so they can be read in one shot
      q.push(cb => this.bus.writeByte(this.address, M_CTRL_REG2, 0b00100000, cb))
      // hybrid mode, disable autocalibration and max out oversample rate
      q.push(cb => this.bus.writeByte(this.address, M_CTRL_REG1, 0b00011111, cb))
      // write initial magnetometer offsets (if they have been pre-calibrated)
      if (this.magnetometerOffset) {
        var buffer = this.sampleBuffer
        buffer[0] = this.magnetometerOffset.x >> 7
        buffer[1] = this.magnetometerOffset.x << 1 & 0xFF
        buffer[2] = this.magnetometerOffset.y >> 7
        buffer[3] = this.magnetometerOffset.y << 1 & 0xFF
        buffer[4] = this.magnetometerOffset.z >> 7
        buffer[5] = this.magnetometerOffset.z << 1 & 0xFF
        q.push(cb => this.bus.writeI2cBlock(this.address, M_OFF_X_MSB, 6, buffer, cb))
      }
      // high resolution/power mode
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG2, 0b00000010, cb))
      // set sample rate and bring device out of standby
      q.push(cb => this.bus.writeByte(this.address, CTRL_REG1, CTRL_REG1_DR[this.sampleRate] << 3 | 0b00000001, cb))
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
    var sample = this.sample
    var int14Scale = 8191
    var int16Scale = 32767
    this.bus.readI2cBlock(this.address, 0x01, 12, buffer, err => {
      if (err) return cb(err)
      // raw accelerometer data is BE 14 bit 2's complement
      this.accelerometer.raw.x = buffer.readInt8(0) << 6 | buffer.readUInt8(1) >> 2
      this.accelerometer.raw.y = buffer.readInt8(2) << 6 | buffer.readUInt8(3) >> 2
      this.accelerometer.raw.z = buffer.readInt8(4) << 6 | buffer.readUInt8(5) >> 2
      // convert to g's
      this.accelerometer.x = this.accelerometer.raw.x / int14Scale * this.accelerometerScaleRange
      this.accelerometer.y = this.accelerometer.raw.y / int14Scale * this.accelerometerScaleRange
      this.accelerometer.z = this.accelerometer.raw.z / int14Scale * this.accelerometerScaleRange
      // raw magnetometer data is BE 16 bit 2's complement
      this.magnetometer.raw.x = buffer.readInt16BE(6)
      this.magnetometer.raw.y = buffer.readInt16BE(8)
      this.magnetometer.raw.z = buffer.readInt16BE(10)
      // unitless magnetometer data is ok?
      this.magnetometer.x = this.magnetometer.raw.x
      this.magnetometer.y = this.magnetometer.raw.y
      this.magnetometer.z = this.magnetometer.raw.z
      cb()
    })
  }

  readMagnetometerOffset (cb) {
    var buffer = new Buffer(6)
    this.bus.readI2cBlock(this.address, M_OFF_X_MSB, 6, buffer, err => {
      if (err) return cb(err)
      // mag offset data is BE 15 bit 2's complement
      var offx = buffer.readInt8(0) << 7 | buffer.readUInt8(1) >> 1
      var offy = buffer.readInt8(2) << 7 | buffer.readUInt8(3) >> 1
      var offz = buffer.readInt8(4) << 7 | buffer.readUInt8(5) >> 1
      cb(null, {
        x: offx,
        y: offy,
        z: offz
      })
    })
  }
}
