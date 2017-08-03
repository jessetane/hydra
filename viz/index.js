var Rpc = require('websocket-rpc')
var Scene3d = require('3d/scene')
var Camera3d = require('3d/camera')
var ReglRenderer = require('3d/regl-renderer')
var Base = require('./base')

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
camera.bindPointerEvents(dom)
scene.start()

var Base = require('./base')
var Vector = require('./vector')

class Plane extends Base {
  constructor (opts) {
    super()
    this.color = [1,0,0,1]
    this.positions = [
      [-0.5, 0.5, 0],
      [0.5, 0.5, 0],
      [0.5, -0.5, 0],
      [-0.5, -0.5, 0]
    ]
    this.cells = [
      [0,1,2],
      [0,3,2]
    ]
  }
}

var plane = new Plane()
scene.addObject(plane)

var server = new Rpc({
  url: hydraUrl,
  serialize: JSON.stringify,
  deserialize: JSON.parse
})

server.on('error', err => {
  console.error(err)
})

server.on('open', () => {
  server.subscribe('sensors.imu.change', imu => {
    plane.rotation = [
      imu.quaternion.x,
      imu.quaternion.y,
      imu.quaternion.z,
      imu.quaternion.w
    ]
  })
})

server.connect()
