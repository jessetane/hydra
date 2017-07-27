var I2cDevice = require('../i2c-device')
var Ahrs = require('ahrs')

// datasheets
// https://www.invensense.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf
// https://www.invensense.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf

var PWR_MGMT_1 = 0x6B
var GYRO_CONFIG = 0x1B
var ACCEL_CONFIG = 0x1C
var ACCEL_XOUT_H = 0x3B

var FS_SEL = {
  '0': 250,
  '1': 500,
  '2': 1000,
  '3': 2000
}

var AFS_SEL = {
  '0': 2,
  '1': 4,
  '2': 8,
  '3': 16
}

module.exports = class Mpu6050 extends I2cDevice {
  constructor (config) {
    super({
      busIndex: config.imu.device.split('-')[1],
      address: config.imu.address
    })
    this.sampleRate = config.imu.sampleRate
    this.gyroscopeScale = config.imu.gyroscopeScale
    this.accelerometerScale = config.imu.accelerometerScale
    this.sampleBuffer = new Buffer(14)
    this.accelerometer = {}
    this.gyroscope = {}
    this.ahrs = new Ahrs({
      sampleInterval: this.sampleRate,
      algorithm: 'Madgwick'
    })
    this.on('open', () => {
      this.initialize(err => {
        if (err) {
          this.emit('error', err)
        } else {
          this.beginCapture()
        }
      })
    })
  }

  open () {
    super.open()
  }

  close () {
    this.endCapture()
    super.close()
  }

  initialize (cb) {
    // take the device out of sleep mode and set the clock to use the x gyro as a reference
    this.wire.writeByte(this.address, PWR_MGMT_1, 1, err => {
      if (err) return cb(new Error('failed to configure clock'))
      // set gyro full-scale range
      this.wire.writeByte(this.address, GYRO_CONFIG, this.gyroscopeScale << 3, err => {
        if (err) return cb(new Error('failed to configure gyroscope'))
        // set accel full-scale range
        this.wire.writeByte(this.address, ACCEL_CONFIG, this.accelerometerScale << 3, err => {
          if (err) return cb(new Error('failed to configure accelerometer'))
          cb()
        })
      })
    })
  }

  beginCapture () {
    var buffer = this.sampleBuffer
    var int16Scale = 32767
    var gyroscopeScale = FS_SEL[this.gyroscopeScale] / 360 * Math.PI * 2
    var accelerometerScale = AFS_SEL[this.accelerometerScale]
    var lastUpdate = null
    this.sampleInterval = setInterval(() => {
      this.wire.readI2cBlock(this.address, ACCEL_XOUT_H, 14, buffer, err => {
        if (err) {
          this.emit('error', new Error('failed to read sensor data'))
        } else {
          var gyro = this.gyroscope = {
            x: buffer.readInt16BE(8) / int16Scale * gyroscopeScale,
            y: buffer.readInt16BE(10) / int16Scale * gyroscopeScale,
            z: buffer.readInt16BE(12) / int16Scale * gyroscopeScale
          }
          var accel = this.accelerometer = {
            x: buffer.readInt16BE(0) / int16Scale * accelerometerScale,
            y: buffer.readInt16BE(2) / int16Scale * accelerometerScale,
            z: buffer.readInt16BE(4) / int16Scale * accelerometerScale
          }
          var now = +new Date()
          this.ahrs.update(
            gyro.x, gyro.y, gyro.z,
            accel.x, accel.y, accel.z,
            0, 0, 0, // XXX need module with compass
            (now - (lastUpdate || now)) / 1000
          )
          lastUpdate = now
        }
      })
    }, 1000 / this.sampleRate)
  }

  endCapture () {
    clearInterval(this.sampleInterval)
  }
}
