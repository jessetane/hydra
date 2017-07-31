var Emitter = require('events')
var SerialPort = require('serialport')

module.exports = class UartDevice extends Emitter {
  constructor () {
    super()
    this.ondata = this.ondata.bind(this)
    this.onerror = this.onerror.bind(this)
    this.separator = '\n'
    this.timeout = 2000
    this.queue = []
    this.buffer = ''
  }

  get isOpen () {
    return this.serialPort.isOpen()
  }

  get isBusy () {
    return this.queue.length > 10
  }

  open () {
    this.serialPort = new SerialPort(this.device, {
      baudRate: this.baudRate
    })
    this.serialPort.on('data', this.ondata)
    this.serialPort.on('error', this.onerror)
  }

  close () {
    this.serialPort.removeListener('data', this.ondata)
    this.serialPort.removeListener('error', this.onerror)
    this.serialPort.close()
    delete this.serialPort
  }

  send (data, cb) {
    if (cb && typeof cb !== 'function') {
      cb = function () {}
    }
    if (!this.serialPort) {
      cb && cb(new Error('serial port is closed'))
      return
    }
    if (!this.serialPort.isOpen()) {
      if (!this.serialPort.opening) {
        this.serialPort.open()
      }
      cb && cb(new Error('serial port is opening'))
      return
    }
    if (cb) {
      cb.timeout = setTimeout(() => {
        this.queue.shift()
        cb(new Error('send timed out'))
      }, this.timeout)
      this.queue.push(cb)
    }
    this.serialPort.write(data + this.separator, err => {
      if (err) {
        if (cb) {
          this.queue = this.queue.filter(_cb => _cb !== cb)
          clearTimeout(cb.timeout)
          cb(err)
        } else {
          this.emit('error', err)
        }
      }
    })
  }

  ondata (data) {
    this.buffer += data.toString('ascii')
    var parts = this.buffer.split(this.separator)
    if (parts.length === 1) return
    var lastPart = parts[parts.length - 1]
    this.buffer = lastPart
    parts.slice(0, -1).forEach(part => {
      var cb = this.queue.shift()
      if (cb) {
        clearTimeout(cb.timeout)
        cb(part)
      } else {
        this.emit('notification', part)
      }
    })
  }

  onerror (err) {
    this.emit('error', err)
  }
}
