#!/usr/bin/env node

var config = require('./config')

var port = config.port || 5566
var address = config.address || '::'

var ws = require('uws')
var Rpc = require('rpc-events')
var Joystick = require('./joystick')
var Mouse = require('./mouse')
var Imu = require('./imu')
var Gps = require('./gps')
var Ptu = require('./ptu')

var joystick = new Joystick(config)
joystick.on('open', () => console.log('joystick: open'))
joystick.on('close', () => console.log('joystick: close'))
joystick.on('error', err => console.error('joystick:', err.message))

var mouse = new Mouse(config)
mouse.on('open', () => console.log('mouse: open'))
mouse.on('close', () => console.log('mouse: close'))
mouse.on('error', err => console.error('mouse:', err.message))

var imu = new Imu(config)
imu.on('open', () => console.log('imu: open'))
imu.on('close', () => console.log('imu: close'))
imu.on('error', err => console.error('imu:', err.message))

var gps = new Gps(config)
gps.on('open', () => console.log('gps: open'))
gps.on('close', () => console.log('gps: close'))
gps.on('error', err => console.error('gps:', err.message))

var ptu = new Ptu(config)
ptu.on('open', () => console.log('ptu: open'))
ptu.on('close', () => console.log('ptu: close'))
ptu.on('error', err => console.error('ptu:', err.message))
ptu.open()

var sensors = { joystick, mouse, imu, gps }
var actuators = { ptu }
var clients = {}

var websocketServer = new ws.Server({ port, host: address }, err => {
  if (err) throw err
  console.log(`websocket server listening at ${websocketServer.httpServer.address().port}`)
  console.log(`hydra is ready`)
})

websocketServer.on('connection', socket => {
  var client = new Rpc()
  client.setInterface('sensors', sensors)
  client.setInterface('actuators', actuators)
  client.id = `${socket.remoteAddress}:${socket.remotePort}`
  clients[client.id] = client
  client.serialize = JSON.stringify
  client.deserialize = JSON.parse
  client.send = socket.send.bind(socket)
  socket.on('message', client.receive)
  socket.on('close', () => {
    client.close()
    delete clients[client.id]
  })
})
