var I2cDevice = require('../device-i2c')
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
    this.gyroscopeScale = config.imu.gyroscopeScale || 2
    this.accelerometerScale = config.imu.accelerometerScale || 2
    this.sampleBuffer = new Buffer(14)
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
    this.ahrs = new Ahrs({
      sampleInterval: this.sampleRate,
      algorithm: 'Madgwick',
      beta: 0.1
    })
  }

  get quaternion () {
    return this.ahrs.getQuaternion()
  }

  get eulerAngles () {
    var angles = this.ahrs.getEulerAngles()
    angles.yaw = angles.heading
    delete angles.heading
    return angles
  }

  _open (cb) {
    super._open(() => {
      var q = new Queue()
      // take the device out of sleep mode and set the clock to use the x gyro as a reference
      q.push(cb => this.wire.writeByte(this.address, PWR_MGMT_1, 1, cb))
      // set gyro full-scale range
      q.push(cb => this.wire.writeByte(this.address, GYRO_CONFIG, this.gyroscopeScale << 3, cb))
      // set accel full-scale range
      q.push(cb => this.wire.writeByte(this.address, ACCEL_CONFIG, this.accelerometerScale << 3, cb))
      q.start(err => {
        if (err) return cb(err)
        clearInterval(this.sampleInterval)
        this.sampleInterval = setInterval(this.onsampleNeeded.bind(this), 1000 / this.sampleRate)
        this.lastUpdate = null
        cb()
        this.emit('open')
      })
    })
  }

  _close (cb) {
    clearInterval(this.sampleInterval)
    this.wire.writeByte(this.address, PWR_MGMT_1, 0, err => {
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

  onsampleNeeded () {
    var buffer = this.sampleBuffer
    var int16Scale = 32767
    var gyroscopeScale = FS_SEL[this.gyroscopeScale] / 360 * Math.PI * 2
    var accelerometerScale = AFS_SEL[this.accelerometerScale]
    this.wire.readI2cBlock(this.address, ACCEL_XOUT_H, 14, buffer, err => {
      if (err) {
        this.emit('error', err)
        return
      }
      // gyro raw
      this.gyroscope.raw.x =  buffer.readInt16BE(8)
      this.gyroscope.raw.y = buffer.readInt16BE(10)
      this.gyroscope.raw.z = buffer.readInt16BE(12)
      // gyro scaled
      this.gyroscope.x = this.gyroscope.raw.x / int16Scale * gyroscopeScale
      this.gyroscope.x = this.gyroscope.raw.x / int16Scale * gyroscopeScale
      this.gyroscope.x = this.gyroscope.raw.x / int16Scale * gyroscopeScale
      // accel raw
      this.accelerometer.raw.x = buffer.readInt16BE(0)
      this.accelerometer.raw.y = buffer.readInt16BE(2)
      this.accelerometer.raw.z = buffer.readInt16BE(4)
      // accel scaled
      this.accelerometer.x = this.accelerometer.raw.x / int16Scale * accelerometerScale
      this.accelerometer.y = this.accelerometer.raw.y / int16Scale * accelerometerScale
      this.accelerometer.z = this.accelerometer.raw.z / int16Scale * accelerometerScale
      // ahrs
      var now = +new Date()
      this.ahrs.update(
        gyro.x, gyro.y, gyro.z,
        accel.x, accel.y, accel.z,
        0, 0, 0, // XXX need module with compass
        (now - (this.lastUpdate || now)) / 1000
      )
      this.lastUpdate = now
      this.emit('change', {
        quaternion: this.quaternion,
        eulerAngles: this.eulerAngles,
        gyroscope: this.gyroscope,
        accelerometer: this.accelerometer
      })
    })
  }
}
