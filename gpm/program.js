var Imu = require('../imu')
var Gpm = require('./')

module.exports = class GpmProgram {
  constructor (config) {
    this.onenterFrame = this.onenterFrame.bind(this)
    this.running = false
    this.input = new Imu(config)
    this.output = new Gpm(config)
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
    setInterval(this.onenterFrame, 1000 / 32)
  }

  stop () {
    clearInterval(this.onenterFrame)
    this.running = false
    this.input.close()
    this.output.close()
  }

  onenterFrame () {
    var euler = this.imu.ahrs.getEulerAngles()
    this.output.roll = euler.roll
    this.output.pitch = euler.pitch
    this.output.yaw = euler.heading
    this.output.lookAt(1, 0)
  }
}
