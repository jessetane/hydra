#!/usr/bin/env node

var minimist = require('minimist')
var os = require('os')
var dgram = require('dgram')
var Rpc = require('rpc-engine')

// parse arguments
var argv = minimist(process.argv.slice(2))

// parse configuration file
var config = null
var configFile = argv.c || argv.config
if (configFile) {
  config = require(
    configFile[0] !== '/'
      ? `${process.cwd()}/${configFile}`
      : configFile
  )
} else {
  try {
    config = require(
      os.homedir() + '/.hydra.json'
    )
  } catch (err) {
    config = require('/etc/hydra/config.json')
  }
}

// available programs
var programs = {
  // joystick: require('./joystick/program'),
  mouse: require('./mouse/program'),
  gpm: require('./gpm/program')
}

// the current program
var program = null

// runtime api
var api = {
  'help': function (cb) {
    cb(null, Object.keys(api).map(method => {
      return {
        method,
        params: api[method].toString().split('(')[1].split(')')[0]
      }
    }))
  },
  'status': function (cb) {
    if (typeof cb !== 'function') return
    cb(null, {
      program: {
        name: program ? program.name : null,
        state: program && program.active ? 'active' : 'inactive'
      }
    })
  },
  'ls': function (cb) {
    if (typeof cb !== 'function') return
    cb(null, Object.keys(programs))
  },
  'start': function (name, cb) {
    if (typeof name === 'function') {
      cb = name
      name = null
    }
    if (typeof cb !== 'function') return
    if (name) {
      var Program = programs[name]
      if (Program) {
        if (program) {
          if (program.name !== name) {
            program.stop()
            program = new Program(config)
          }
        } else {
          program = new Program(config)
        }
        program.start(cb)
      } else {
        cb(new Error('unknown program'))
      }
    } else if (program) {
      program.start(cb)
    } else {
      cb(new Error('program name required'))
    }
  },
  'stop': function (cb) {
    if (program) {
      program.stop()
    }
    if (typeof cb === 'function') {
      cb()
    }
  }
}

// start up task queue
var enqueued = 0
function dequeue (err) {
  if (err) throw err
  if (--enqueued !== 0) return
  console.log('hydra is ready')
}

// expose remote interface if configured
// exposed via jsonrpc over udp
if (config.remoteInterface) {
  enqueued++

  class Client extends Rpc {
    constructor (opts) {
      super()
      this.port = opts.port
      this.address = opts.address
      this.methods = api
    }

    serialize (message) {
      return new Buffer(JSON.stringify(message))
    }

    deserialize (message) {
      return JSON.parse(message.toString('utf8'))
    }

    send (message) {
      udpSocket.send(message, this.port, this.address)
    }
  }

  var udpSocket = dgram.createSocket('udp6')
  var clients = {}

  udpSocket.on('message', (message, sender) => {
    var { address, port } = sender
    var id = address + ':' + port
    var client = clients[id]
    if (!client) {
      client = clients[id] = new Client({
        address,
        port
      })
    }
    client.onmessage(message)
  })

  udpSocket.bind({
    address: config.remoteInterface.address || '::1',
    port: config.remoteInterface.port || 556677
  }, err => {
    if (err) {
      console.error(`remote interface failed to bind ${address}:${port}`)
    } else {
      var { address, port } = udpSocket.address()
      console.log(`remote interface bound to ${address}:${port}`)
    }
    dequeue()
  })
}

// start default program if specified
if (config.defaultProgram) {
  enqueued++
  api.start(config.defaultProgram, err => {
    if (err) {
      console.error(err.message)
    } else {
      console.log(`${program.name} program started`)
    }
    dequeue()
  })
}
