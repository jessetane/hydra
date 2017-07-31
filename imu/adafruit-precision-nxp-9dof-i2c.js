var Emitter = require('events')
var Fxos8700cq = require('../imu/fxos8700cq')
var Fxas21002c = require('../imu/fxas21002c')
var Ahrs = require('ahrs')

module.exports = class AdafruitPrecisionNxp extends Emitter {
  constructor (config) {
    super()
    this.ondeviceReady = this.ondeviceReady.bind(this)
    this.onsampleNeeded = this.onsampleNeeded.bind(this)
    this.sampleRate = config.imu.sampleRate || 64
    this.accelerometer = new Fxos8700cq(config)
    this.gyroscope = new Fxas21002c(config)
    this.ahrs = new Ahrs({
      sampleInterval: this.sampleRate,
      algorithm: 'Madgwick',
      beta: 0.25
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

  open () {
    this.devicesPending = 2
    this.accelerometer.on('ready', this.ondeviceReady)
    this.gyroscope.on('ready', this.ondeviceReady)
    this.accelerometer.open()
    this.gyroscope.open()
  }

  close () {
    clearInterval(this.sampleInterval)
    this.accelerometer.removeListener('ready', this.ondeviceReady)
    this.gyroscope.removeListener('ready', this.ondeviceReady)
    this.accelerometer.close()
    this.gyroscope.close()
  }

  ondeviceReady () {
    if (--this.devicesPending !== 0) return
    this.lastUpdate = null
    this.sampleInterval = setInterval(this.onsampleNeeded, 1000 / this.sampleRate)
  }

  onsampleNeeded () {
    this.gyroscope.read(err => {
      if (err) this.emit('error', err)
      this.accelerometer.read(err => {
        if (err) this.emit('error', err)
        var now = +new Date()
        var a = this.accelerometer.accelerometer
        var g = this.gyroscope
        var m = this.accelerometer.magnetometer
        this.ahrs.update(
          g.x, g.y, g.z,
          a.x, a.y, a.z,
          m.x, m.y, m.z,
          (now - (this.lastUpdate || now)) / 1000
        )
        this.lastUpdate = now
        this.emit('change')
      })
    })
  }
}
