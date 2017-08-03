var Object3d = require('3d/object')
var ReglRenderer = require('3d/regl-renderer')

module.exports = class Base extends Object3d {
  constructor () {
    super()
    this.color = [1,0,0,0]
    this.positions = [[0,0,0]]
    this.cells = [[0,0,0]]
    this.vert = ReglRenderer.defaultVert
    this.frag = ReglRenderer.defaultFrag
    this.createDrawCall = regl => regl(ReglRenderer.getDefaultOpts(regl))
  }
}
