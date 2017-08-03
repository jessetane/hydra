var Device = require('../device')
var SerialPort = require('serialport')
var Queue = require('queue')

module.exports = class UartDevice extends Device {
  constructor (opts) {
    super()
    this.device = opts.device
    if (!this.device) {
      throw new Error('uart device is required')
    }
    this.baudRate = opts.baudRate
    if (!this.baudRate) {
      throw new Error('baud rate is required')
    }
    this.timeout = opts.timeout || 500
    this.delimiter = opts.delimiter || '\r\n'
    this.maxQueueLength = opts.maxQueueLength || 10
    this.mainQueue = []
    this.queues = {}
    this.ondata = this.ondata.bind(this)
  }

  _open (cb) {
    if (this.port) return cb()
    this.port = new SerialPort(this.device, {
      baudRate: this.baudRate
    }, err => {
      if (err) return cb(err)
      this.port.on('data', this.ondata)
      cb()
    })
  }

  _close (cb) {
    this.port.removeListener('data', this.ondata)
    if (this.port.isOpen()) {
      this.port.close()
    }
    delete this.port
    this.flush()
    cb()
  }

  watchdog (cb) {
    if (this.port.isOpen()) return cb()
    this.port.removeListener('data', this.ondata)
    delete this.port
    this.flush()
    cb(new Error('port closed'))
  }

  setBaudRate (baudRate, cb) {
    this.port.update({ baudRate }, err => {
      if (err) return cb(err)
      this.baudRate = baudRate
      this.flush()
      setTimeout(cb)
    })
  }

  send (data, queue, cb) {
    if (typeof queue === 'function') {
      cb = queue
      queue = null
    }
    if (typeof cb !== 'function') {
      cb = () => {}
    }
    var q = null
    if (typeof queue === 'string') {
      q = this.queues[queue]
      if (!q) {
        q = this.queues[queue] = []
      }
    } else {
      q = this.mainQueue
      queue = null
    }
    if (q.length > this.maxQueueLength) {
      cb(new Error('uart is busy'))
      return
    }
    q.push(cb)
    cb.timeout = setTimeout(() => {
      this.dequeueCallback(queue, cb)
      cb(new Error('send timed out'))
      cb = null
    }, this.timeout)
    this.port.write(data + this.delimiter, err => {
      if (!cb) return
      if (!queue) {
        this.dequeueCallback(null, cb)
        cb(err)
      }
    })
  }

  ondata (data) {
    data = data.toString('ascii')
    this.buffer += data
    var parts = this.buffer.split(this.delimiter)
    if (parts.length === 1) return
    var lastPart = parts[parts.length - 1]
    this.buffer = lastPart
    parts.slice(0, -1).forEach(part => {
      var queue = null
      for (var name in this.queues) {
        if (part.indexOf(name) === 0) {
          queue = name
          break
        }
      }
      if (queue) {
        var cb = this.dequeueCallback(queue)
        if (cb) {
          clearTimeout(cb.timeout)
          cb(null, part)
          return
        }
      }
      this.emit('notification', part)
    })
  }

  dequeueCallback (queue, cb) {
    var q = this.mainQueue
    if (queue) {
      q = this.queues[queue]
      if (cb) {
        this.queues[queue] = q = q.filter(_cb => _cb !== cb)
        if (q.length === 0) {
          delete this.queues[queue]
        }
      } else {
        cb = q.shift()
      }
    } else {
      if (cb) {
        this.mainQueue = q.filter(_cb => _cb !== cb)
      } else {
        this.mainQueue.shift()
      }
    }
    if (cb) {
      clearTimeout(cb.timeout)
    }
    return cb
  }

  flush () {
    this.buffer = ''
    this.mainQueue.forEach(cb => clearTimeout(cb.timeout))
    this.mainQueue = []
    for (var queue in this.queues) {
      var q = this.queues[queue]
      q.forEach(cb => clearTimeout(cb.timeout))
      delete this.queues[queue]
    }
  }
}
