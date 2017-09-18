var RpcWs = require('rpc-events-ws-client')
var Scene3d = require('3d/scene')
var Camera3d = require('3d/camera')
var ReglRenderer = require('3d/regl-renderer')
var Accelerometer = require('./accelerometer')
var Gyroscope = require('./gyroscope')
var Magnetometer = require('./magnetometer')

var scene = new Scene3d()
window.addEventListener('resize', scene.resize)

var camera = new Camera3d()
camera.origin = [0,0,0]
camera.zoom = 3
camera.fov = Math.PI / 4
scene.addObject(camera)

var canvas = document.querySelector('#regl')
var reglRenderer = new ReglRenderer(canvas)
camera.addRenderer(reglRenderer)

var dom = document.querySelector('#dom')
dom.addEventListener('wheel', evt => {
  camera.zoom += evt.deltaY / 50
  camera.zoom = Math.min(camera.zoom, 200)
  camera.zoom = Math.max(camera.zoom, 1)
})
dom.addEventListener('click', () => {
  console.log(
    gyroscope.magnitude,
    accelerometer.magnitude,
    magnetometer.magnitude
  )
})
camera.bindPointerEvents(dom)
scene.start()

var gyroscope = new Gyroscope()
gyroscope.origin = [ -0.75, 0, 0 ]
scene.addObject(gyroscope)

var accelerometer = new Accelerometer()
accelerometer.origin = [ 0, 0, 0 ]
scene.addObject(accelerometer)

var magnetometer = new Magnetometer()
magnetometer.origin = [ 0.75, 0, 0 ]
scene.addObject(magnetometer)

var server = new RpcWs({
  url: remote,
  serialize: JSON.stringify,
  deserialize: JSON.parse
})

server.subscribe('sensors.imu.change', data => {
  gyroscope.onchange(data.gyroscope)
  accelerometer.onchange(data.accelerometer)
  magnetometer.onchange(data.magnetometer)
})
