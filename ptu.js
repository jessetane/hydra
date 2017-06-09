var Emitter = require('events')

module.exports = class PanTiltUnit extends Emitter {
  constructor (serialPort) {
    super()
    this._ondata = this._ondata.bind(this)
    this._responseQueue = []
    this._responseBuffer = ''
    this._serialPort = serialPort
    this._serialPort.on('data', this._ondata)
    this._serialPort.on('open', () => {
      this.ready = true
      this.emit('ready')
    })
  }

  get busy () {
    return this._responseQueue.length > 10
  }

  execute (command, cb) {
    this._responseQueue.push(cb)
    this._serialPort.write(command + '\n', err => {
      if (err) {
        var cb = this._responseQueue.shift()
        if (cb) {
          cb(err)
        }
      }
    })
    clearTimeout(this._responseTimeout)
    this._responseTimeout = setTimeout(() => {
      var cb = this._responseQueue.shift()
      if (cb) {
        cb(new Error('command timed out'))
      }
    }, 100)
  }

  _ondata (data) {
    this._responseBuffer += data.toString('ascii')
    var parts = this._responseBuffer.split('\n')
    if (parts.length > 2) {
      this._responseBuffer = ''
      clearTimeout(this._responseTimeout)
      var response = parts[1]
      var cb = this._responseQueue.shift()
      if (cb) {
        cb(null, response)
      }
    }
  }
}
