var fs = require('fs')
var http = require('http')
var ws = require('uws')
var ecstatic = require('ecstatic')
var Rpc = require('rpc-engine')
var Browserify = require('browserify')
var Watchify = require('watchify')
var Imu = require('../imu')

module.exports = class GuiProgram {
  constructor (config) {
    config.imu.sampleRate = 32
    config.gui = config.gui || {}
    this.port = config.gui.port || 8080
    this.address = config.gui.address || '::'
    this.remote = config.gui.remote
    this.buildBrowserJs = this.buildBrowserJs.bind(this)
    this.onhttpRequest = this.onhttpRequest.bind(this)
    this.onwebSocket = this.onwebSocket.bind(this)
    this.onimuChange = this.onimuChange.bind(this)
    this.httpServer = new http.Server()
    this.fileServer = ecstatic(__dirname + '/', {
      cache: 'no-cache'
    })
    if (!this.remote) {
      this.webSocketServer = new ws.Server({
        server: this.httpServer
      })
      this.imu = new Imu(config)
      this.clients = {}
    }
    this.running = false
  }

  start (cb) {
    if (this.running) {
      cb()
      return
    } else {
      this.running = true
    }
    var remote = this.remote
    this.browserify = Browserify(__dirname + '/index.js', {
      cache: {},
      packageCache: {},
      plugin: [ Watchify ],
      insertGlobalVars: {
        remote: () => `'${this.remote}'`
      }
    })
    this.browserify.on('update', this.buildBrowserJs)
    this.buildBrowserJs(err => {
      if (!this.running) return
      if (err) return cb(err)
      console.log(`gui: browser javascript built successfully`)
      this.startHttpServer(err => {
        if (!this.running) return
        if (err) return cb(err)
        console.log(`gui: http server listening on ${this.httpServer.address().port}`)
        if (!this.remote) {
          this.imu.on('change', this.onimuChange)
          this.imu.open()
        }
        cb()
      })
    })
  }

  stop () {
    if (!this.running) return
    this.running = false
    if (!this.remote) {
      this.webSocketServer.removeListener('connection', this.onwebSocket)
      this.imu.removeListener('change', this.onimuChange)
      this.imu.close()
    }
    this.browserify.removeListener('update', this.buildBrowserJs)
    this.browserify.close()
    this.httpServer.removeListener('request', this.onhttpRequest)
    this.httpServer.close()
  }

  buildBrowserJs (cb) {
    var file = fs.createWriteStream(__dirname + '/build.js')
    file.on('finish', done)
    file.on('error', done)
    this.browserify.bundle()
      .on('error', done)
      .pipe(file)
    function done (err) {
      if (err) {
        err.message = 'error building js: ' + (err.annotated ? err.annotated.slice(1) : err.message)
      }
      if (typeof cb === 'function') {
        cb(err)
      } else if (err) {
        console.error(err.message)
      } else {
        console.log('gui: browser javascript built successfully')
      }
    }
  }

  startHttpServer (cb) {
    if (!this.remote) {
      this.webSocketServer.on('connection', this.onwebSocket)
    }
    this.httpServer.on('request', this.onhttpRequest)
    this.httpServer.listen(this.port, this.address, cb)
  }

  onhttpRequest (req, res) {
    this.fileServer(req, res, () => {
      req.url = '/'
      res.statusCode = 200
      this.fileServer(req, res)
    })
  }

  onwebSocket (socket) {
    var client = new Rpc()
    client.serialize = JSON.stringify
    client.deserialize = JSON.parse
    client.send = socket.send.bind(socket)
    socket.on('message', client.onmessage.bind(this))
    socket.on('close', () => delete this.clients[client.id])
    client.id = `${socket.remoteAddress}:${socket.remotePort}`
    this.clients[client.id] = client
  }

  onimuChange () {
    var q = this.imu.quaternion
    var g = {
      x: this.imu.gyroscope.x,
      y: this.imu.gyroscope.y,
      z: this.imu.gyroscope.z
    }
    for (var id in this.clients) {
      this.clients[id].call('change', {
        quaternion: q,
        accelerometer: this.imu.accelerometer.accelerometer,
        magnetometer: this.imu.accelerometer.magnetometer,
        gyroscope: g
      })
    }
  }
}
