var I2cDevice = require('../i2c-device')

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

module.exports = class Fxos8700cq extends I2cDevice {
  constructor (config) {
    super({
      busIndex: config.imu.device.split('-')[1],
      address: config.imu.accelerometerAddress || 0x1f
    })
    this.accelerometerScaleRange = parseInt(config.imu.accelerometerScaleRange || 8, 10)
    this.sampleRate = parseInt(config.imu.accelerometerSampleRate || 400, 10)
    this.sampleBuffer = new Buffer(12)
    this.raw = {
      accelerometer: {
        x: 0,
        y: 0,
        z: 0
      },
      magnetometer: {
        x: 0,
        y: 0,
        z: 0
      }
    }
    this.accelerometer = {
      x: 0,
      y: 0,
      z: 0
    }
    this.magnetometer = {
      x: 0,
      y: 0,
      z: 0
    }
    this.on('open', () => this.initialize())
  }

  close () {
    this.wire.writeByte(this.address, CTRL_REG1, 0, err => {
      if (err) {
        this.emit('error', new Error('failed to put device in standby mode'))
      }
      super.close()
    })
  }

  initialize () {
    // soft reset
    this.wire.writeByte(this.address, CTRL_REG2, 0b01000000, () => {
      // configure accelerometer scale range
      this.wire.writeByte(this.address, XYZ_DATA_CFG, XYZ_DATA_CFG_FS[this.accelerometerScaleRange], err => {
        if (err) return this.emit('error', new Error('failed configure accelerometer: ' + err.message))
        // enable magnetometer, use autocalibration and max out oversample rate
        this.wire.writeByte(this.address, M_CTRL_REG1, 0b10011111, err => {
          if (err) return this.emit('error', new Error('failed to configure magnetometer reg1: ' + err.message))
          // jump to magnetometer registers after reading accelerometer registers so they can be read in one shot
          this.wire.writeByte(this.address, M_CTRL_REG2, 0b00100000, err => {
            if (err) return this.emit('error', new Error('failed to configure magnetometer reg2: ' + err.message))
            // high resolution/power mode
            this.wire.writeByte(this.address, CTRL_REG2, 0b00000010, err => {
              if (err) return this.emit('error', new Error('failed to set high resolution mode: ' + err.message))
              // set sample rate and bring device out of standby
              this.wire.writeByte(this.address, CTRL_REG1, CTRL_REG1_DR[this.sampleRate] << 3 | 0b00000001, err => {
                if (err) return this.emit('error', new Error('failed to reset: ' + err.message))
                this.emit('ready')
              })
            })
          })
        })
      })
    })
  }

  read (cb) {
    var buffer = this.sampleBuffer
    var int14Scale = 8191
    var int16Scale = 32767
    this.wire.readI2cBlock(this.address, 0x01, 12, buffer, err => {
      if (!err) {
        // raw accelerometer data is BE 14 bit 2's complement
        this.raw.accelerometer.x = buffer.readInt8(0) << 6 | buffer.readUInt8(1) >> 2
        this.raw.accelerometer.y = buffer.readInt8(2) << 6 | buffer.readUInt8(3) >> 2
        this.raw.accelerometer.z = buffer.readInt8(4) << 6 | buffer.readUInt8(5) >> 2
        // convert to g's
        this.accelerometer.x = this.raw.accelerometer.x / int14Scale * this.accelerometerScaleRange
        this.accelerometer.y = this.raw.accelerometer.y / int14Scale * this.accelerometerScaleRange
        this.accelerometer.z = this.raw.accelerometer.z / int14Scale * this.accelerometerScaleRange
        // raw magnetometer data is BE 16 bit 2's complement
        this.raw.magnetometer.x = buffer.readInt16BE(6)
        this.raw.magnetometer.y = buffer.readInt16BE(8)
        this.raw.magnetometer.z = buffer.readInt16BE(10)
        // unitless magnetometer data is fine for our purposes
        this.magnetometer.x = this.raw.magnetometer.x
        this.magnetometer.y = this.raw.magnetometer.y
        this.magnetometer.z = this.raw.magnetometer.z
      }
      cb(err)
    })
  }
}
