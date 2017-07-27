#!/usr/bin/env node

var minimist = require('minimist')
var os = require('os')
var dgram = require('dgram')
var Rpc = require('rpc-engine')

// parse arguments
var argv = minimist(process.argv.slice(2))
if (argv._.length === 0) {
  argv._ = [ 'help' ]
}
var address = argv.address || argv.a || '::1'
var port = argv.port || argv.p || 55667

// create udp socket for jsonrpc transport
var udpSocket = dgram.createSocket('udp6')

class Hydra extends Rpc {
  constructor (opts) {
    super()
    this.timeout = 2000
  }

  serialize (message) {
    return new Buffer(JSON.stringify(message))
  }

  deserialize (message) {
    return JSON.parse(message.toString('utf8'))
  }

  send (message) {
    udpSocket.send(message, port, address)
  }
}

var hydra = new Hydra()

udpSocket.on('message', message => hydra.onmessage(message))

hydra.call.apply(hydra, argv._.concat([(err, res) => {
  if (err) {
    if (err.code) {
      err.message = err.message[0].toLowerCase() + err.message.slice(1)
    }
    console.error(err.message)
  } else {
    if (!res) res = {}
    res.status = 'ok'
    console.log(JSON.stringify(res, null, 2))
  }
  process.exit(err ? 1 : 0)
}]))
