var Joystick = require('joystick')
var SerialPort = require('serialport')
var PanTiltUnit = require('./ptu')

// setup joystick
var joystickId = process.env.JOYSTICK_ID
var joystickResolution = parseInt(process.env.JOYSTICK_RESOLUTION, 10)
var joystickDeadzone = process.env.JOYSTICK_DEADZONE
var joystickSensitivity = process.env.JOYSTICK_SENSITIVITY
var joystick = new Joystick(
  joystickId,
  joystickDeadzone,
  joystickSensitivity
)

joystick.pan = 0
joystick.tilt = 0

joystick.on('ready', () => {
  joystick.ready = true
  main()
})

joystick.on('error', err => {
  throw new Error('joystick error', err)
})

// setup pan tilt unit
var ptuSeriaPort = process.env.PTU_SERIALPORT
var ptuBaudRate = parseInt(process.env.PTU_BAUD_RATE, 10)
var ptuMaxPanRate = parseInt(process.env.PTU_MAX_PAN_RATE, 10)
var ptuMaxTiltRate = parseInt(process.env.PTU_MAX_TILT_RATE, 10)
var ptu = new PanTiltUnit(
  new SerialPort(ptuSeriaPort, { ptuBaudRate })
)

ptu.on('ready', () => {
  ptu.execute('C', err => {
    if (err) throw err
    ptu.execute('SPS12000', err => {
      if (err) throw err
      ptu.execute('STS12000', err => {
        if (err) throw err
        main()
      })
    })
  })
})

ptu.on('close', () => {
  throw new Error('serial port disconnected')
})

// program
function main () {
  if (joystick.ready && ptu.ready) {
    console.log('hydra is ready')
  } else {
    return
  }

  joystick.on('axis', evt => {
    var value = evt.value / joystickResolution
    var valueAbsolute = Math.abs(value)
    value *= valueAbsolute * valueAbsolute
    if (evt.number === 3) {
      joystick.pan = value
    } else if (evt.number === 4) {
      joystick.tilt = -value
    }
  })

  var axes = [ 'pan', 'tilt' ]
  var i = 0

  // control loop
  setInterval(() => {
    if (ptu.busy) {
      return
    }
    if (i === axes.length) {
      i = 0
    }
    var axis = axes[i++]
    var delta = 0
    if (axis === 'pan') {
      if (joystick.pan !== 0) {
        delta = Math.round(joystick.pan * ptuMaxPanRate)
        ptu.execute('PO' + delta, err => {
          if (err) throw err
        })
      }
    } else if (axis === 'tilt') {
      if (joystick.tilt !== 0) {
        delta = Math.round(joystick.tilt * ptuMaxTiltRate)
        ptu.execute('TO' + delta, err => {
          if (err) throw err
        })
      }
    }
  }, 0)
}
