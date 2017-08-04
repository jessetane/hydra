var Device = require('../device')
var fs = require('fs')

module.exports = class Mouse extends Device {
  constructor (config) {
    super()
    this.device = config.mouse.device
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
      var x = buffer.readInt8(1)
      var y = buffer.readInt8(2)
      var buttons = buffer[0]
      buttons = {
        left: buttons & 0x1,
        middle: buttons & 0x4,
        right: buttons & 0x2
      }
      this.emit('change', { x, y, buttons })
      this.poll()
    })
  }
}
