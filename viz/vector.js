var Base = require('./base')
var loft = require('loft')
var vec3 = require('gl-vec3')

module.exports = class Vector extends Base {
  constructor (opts = {}) {
    super()
    for (var key in opts) {
      this[key] = opts[key]
    }
  }

  update () {
    var line = loft(
      this.origin,
      vec3.add([], this.origin, this.magnitude || [0,0,0]),
      this.radius || 0.01,
      5
    )
    this.positions = line.positions
    this.cells = line.cells
    super.update()
  }
}
