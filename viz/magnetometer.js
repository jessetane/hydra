var Base = require('./base')
var Vector = require('./vector')

module.exports = class Magnetometer extends Base {
  constructor (opts) {
    super()
    this.bufferSize = 10
    this.buffer = []
    this.scale = 1/600
    this.magnitude = [0,0,0]
    this.vector = new Vector({
      color: [1,0,1,1],
      radius: 0.005
    })
    this.axes = {
      x: new Vector({ color: [1,0,0,1] }),
      y: new Vector({ color: [0,1,0,1] }),
      z: new Vector({ color: [0,0,1,1] })
    }
    this.min = {
      x: NaN,
      y: NaN,
      z: NaN
    }
    this.max = {
      x: NaN,
      y: NaN,
      z: NaN
    }
    this.offset = {
      x: 0,
      y: 0,
      z: 0
    }
  }

  connectedCallback () {
    this.scene.addObject(this.vector)
    for (var axisName in this.axes) {
      var axis = this.axes[axisName]
      this.scene.addObject(axis)
    }
  }

  disconnectedCallback () {
    this.scene.removeObject(this.vector)
    for (var axisName in this.axes) {
      var axis = this.axes[axisName]
      this.scene.removeObject(axis)
    }
  }

  onchange (sample) {
    // buffer samples until we have enough
    this.buffer.push(sample)
    if (this.buffer.length < this.bufferSize) {
      return
    } else {
      while (this.buffer.length > this.bufferSize) {
        this.buffer.shift()
      }
    }
    // average bufferSize samples
    var x = 0
    var y = 0
    var z = 0
    this.buffer.forEach(sample => {
      x += sample.x
      y += sample.y
      z += sample.z
    })
    x /= this.bufferSize
    y /= this.bufferSize
    z /= this.bufferSize
    // turns out the module can do this internally, see: M_CTRL_REG1, acal bit
    // dynamically compute offsets
    // this.computeOffset(x, 'x')
    // this.computeOffset(y, 'y')
    // this.computeOffset(z, 'z')
    // // apply offsets
    // x -= this.offset.x
    // y -= this.offset.y
    // z -= this.offset.z
    // scale and translate to webgl coords
    this.magnitude = [
      x * this.scale * -1,
      z * this.scale * -1,
      y * this.scale
    ]
  }

  computeOffset (sample, axis) {
    var needsOffsetUpdate = false
    if (isNaN(this.min[axis]) || sample < this.min[axis]) {
      this.min[axis] = sample
      needsOffsetUpdate = true
    }
    if (isNaN(this.max[axis]) || sample > this.max[axis]) {
      this.max[axis] = sample
      needsOffsetUpdate = true
    }
    if (needsOffsetUpdate) {
      this.offset[axis] = this.min[axis] + (this.max[axis] - this.min[axis]) / 2
    }
  }

  update () {
    this.vector.origin = this.origin
    this.vector.magnitude = this.magnitude
    var i = 0
    for (var axisName in this.axes) {
      var axis = this.axes[axisName]
      axis.origin = this.origin
      axis.magnitude = [0,0,0]
      axis.magnitude[i] = this.magnitude[i++]
    }
    super.update()
  }
}
