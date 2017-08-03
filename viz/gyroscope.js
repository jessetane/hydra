var Base = require('./base')
var Vector = require('./vector')

module.exports = class Gyroscope extends Base {
  constructor (opts) {
    super()
    this.scale = 1
    this.magnitude = [0,0,0]
    this.vector = new Vector({
      color: [0,1,0,1]
    })
  }

  connectedCallback () {
    this.scene.addObject(this.vector)
  }

  disconnectedCallback () {
    this.scene.removeObject(this.vector)
  }

  onchange (sample) {
    this.magnitude = [
      sample.x * this.scale * -1,
      sample.z * this.scale * -1,
      sample.y * this.scale
    ]
  }

  update () {
    this.vector.origin = this.origin
    this.vector.magnitude = this.magnitude
    super.update()
  }
}
