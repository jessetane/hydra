var Imu = require('../imu')
var Uart = require('../uart-device')

module.exports = class ImuCalibrate {
  constructor (config) {
    this.onimuChange = this.onimuChange.bind(this)
    this.running = false
    this.input = new Imu(config)
    this.output = new Uart()
    this.output.device = config.imu.calibrationOutputDevice || '/dev/ttyS0'
    this.output.baudRate = 115200 // required speed for motioncal
  }

  start (cb) {
    if (this.running) {
      cb()
      return
    } else {
      this.running = true
    }
    this.input.open()
    this.output.open()
    this.input.on('change', this.onimuChange)
    cb()
  }

  stop () {
    this.running = false
    this.input.removeListener('change', this.onimuChange)
    this.input.close()
    this.output.close()
  }

  onimuChange () {
    if (!this.output.isOpen || this.output.isBusy) {
      return
    }
    var a = this.input.accelerometer.raw.accelerometer
    var g = this.input.gyroscope.raw
    var m = this.input.accelerometer.raw.magnetometer
    this.output.send(`Raw:${a.x},${a.y},${a.z},${g.x},${g.y},${g.z},${m.x},${m.y},${m.z}\r\n`)
  }
}
