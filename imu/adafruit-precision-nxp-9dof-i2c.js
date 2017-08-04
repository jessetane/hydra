var Device = require('../device')
var Fxos8700cq = require('../imu/fxos8700cq')
var Fxas21002c = require('../imu/fxas21002c')
var Ahrs = require('ahrs')
var Queue = require('queue')

module.exports = class AdafruitPrecisionNxp extends Device {
  constructor (config) {
    super()
    this.sampleRate = config.imu.sampleRate || 64
    this.accelerometer = new Fxos8700cq(config)
    this.accelerometer.on('error', err => this.emit('error', err))
    this.gyroscope = new Fxas21002c(config)
    this.gyroscope.on('error', err => this.emit('error', err))
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
    var q = new Queue()
    q.push(cb => this.accelerometer.open(cb))
    q.push(cb => this.gyroscope.open(cb))
    q.start(err => {
      clearInterval(this.sampleInterval)
      this.sampleInterval = setInterval(this.onsampleNeeded.bind(this), 1000 / this.sampleRate)
      this.lastUpdate = null
      this.ahrs = new Ahrs({
        sampleInterval: this.sampleRate,
        algorithm: 'Madgwick',
        beta: 0.1
      })
      cb(err)
      this.emit('open')
    })
  }

  _close (cb) {
    clearInterval(this.sampleInterval)
    var q = new Queue()
    q.push(cb => this.accelerometer.close(cb))
    q.push(cb => this.gyroscope.close(cb))
    q.start(err => {
      cb(err)
      this.emit('close')
    })
  }

  onsampleNeeded () {
    var q = new Queue()
    q.push(cb => this.gyroscope.read(cb))
    q.push(cb => this.accelerometer.read(cb))
    q.start(err => {
      if (err) return
      var a = this.accelerometer.accelerometer
      var g = this.gyroscope.gyroscope
      var m = this.accelerometer.magnetometer
      var now = +new Date()
      this.ahrs.update(
        g.x, g.y, g.z,
        a.x, a.y, a.z,
        m.x, m.y, m.z,
        (now - (this.lastUpdate || now)) / 1000
      )
      this.lastUpdate = now
      this.emit('change', {
        quaternion: this.quaternion,
        eulerAngles: this.eulerAngles,
        accelerometer: this.accelerometer.accelerometer,
        magnetometer: this.accelerometer.magnetometer,
        gyroscope: this.gyroscope.gyroscope
      })
    })
  }
}
