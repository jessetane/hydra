var Device = require('../device')
var fs = require('fs')

module.exports = class Joystick extends Device {
  constructor (config) {
    super()
    this.device = config.joystick.device
    this.sampleBuffer = new Buffer(8)
  }

  _open (cb) {
    fs.open(this.device, 'r', (err, fd) => {
      if (err) return cb(err)
      this.fileDescriptor = fd
      this.poll()
      cb()
    })
  }

  _close (cb) {
    var fd = this.fileDescriptor
    this.fileDescriptor = null
    fs.close(fd, cb)
  }

  watchdog (cb) {
    if (!this.fileDescriptor) {
      cb(new Error('device not open'))
    } else {
      cb()
    }
  }

  poll () {
    var buffer = this.sampleBuffer
    fs.read(this.fileDescriptor, buffer, 0, 8, null, err => {
      if (err) {
        delete this.fileDescriptor
        return
      }
      var type = buffer[6]
      var number = buffer[7]
      var value = buffer.readInt16LE(4)
      if (type & 0x1) {
        type = 'button'
      } else if (type & 0x2) {
        type = 'axis'
      }
      this.emit('change', { type, number, value })
      this.poll()
    })
  }
}
