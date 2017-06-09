var Emitter = require('events')

module.exports = class PanTiltUnit extends Emitter {
  constructor (serialPort) {
    super()
    this._ondata = this._ondata.bind(this)
    this._responseCallback = null
    this._responseBuffer = ''
    this._serialPort = serialPort
    this._serialPort.on('open', () => {
      this.ready = true
      this.emit('ready')
    })
  }

  get busy () {
    return this._responseCallback !== null
  }

  execute (command, cb) {
    if (this._responseCallback) {
      return cb(new Error('command in flight'))
    }
    this._responseCallback = cb
    this._responseBuffer = ''
    this._serialPort.on('data', this._ondata)
    this._serialPort.write(command + '\n', err => {
      if (err) {
        this._responseCallback = null
        cb(err)
      }
    })
    this._responseTimeout = setTimeout(() => {
      this._responseCallback = null
      cb(new Error('command timed out'))
    }, 100)
  }

  _ondata (data) {
    this._responseBuffer += data.toString('ascii')
    var parts = this._responseBuffer.split('\n')
    if (parts.length > 2) {
      clearTimeout(this._responseTimeout)
      this._serialPort.removeListener('data', this._ondata)
      var cb = this._responseCallback
      this._responseCallback = null
      var response = parts[1]
      cb(null, response)
    }
  }
}
