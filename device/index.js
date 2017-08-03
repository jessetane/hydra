// abstract base class for hardware devices
// idea is to open and close automatically
// based on whether anyone is actively
// listening to the "change" event

var Emitter = require('events')
var Queue = require('queue')

module.exports = class Device extends Emitter {
  constructor () {
    super()
    this.state = 'closed'
    this.watchdogInterval = 2000
    this.queue = new Queue({
      concurrency: 1,
      autostart: true
    })
    this.queue.on('error', err => this.emit('error', err))
  }

  on (event, fn) {
    this.addListener(event, fn)
  }

  addListener (event, fn) {
    if (event === 'change') {
      if (this.listenerCount(event) === 0) {
        this.open()
      }
    }
    super.addListener(event, fn)
  }

  removeListener (event, fn) {
    super.removeListener(event, fn)
    if (event === 'change') {
      if (this.listenerCount(event) === 0) {
        this.close()
      }
    }
  }

  open (cb) {
    this.queue.push(cb2 => {
      this.state = 'opening'
      if (!this._watchdog) {
        this._watchdog = setInterval(() => {
          if (this.state !== 'opening' && this.watchdog) {
            this.watchdog(err => {
              if (err) {
                this.emit('error', err)
                this.open()
              }
            })
          }
        }, this.watchdogInterval)
      }
      this._open(err => {
        if (err) {
          this.state = 'error'
        } else {
          this.state = 'open'
        }
        if (cb) {
          cb(err)
          cb2()
        } else {
          cb2(err)
        }
      })
    })
  }

  _open (cb) {
    // subclasses must implement
    cb()
  }

  close (cb) {
    clearInterval(this._watchdog)
    this.queue.push(cb2 => {
      this.state = 'closing'
      this._watchdog = null
      this._close(err => {
        this.state = 'closed'
        if (cb) {
          cb(err)
          cb2()
        } else {
          cb2(err)
        }
      })
    })
  }

  _close (cb) {
    // subclasses must implement
    cb()
  }
}
