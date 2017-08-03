var UartDevice = require('../device-uart')
var GpsParser = require('gps')
var Queue = require('queue')

// docs
// https://cdn-shop.adafruit.com/datasheets/PMTK_A11.pdf
// https://learn.adafruit.com/adafruit-ultimate-gps/arduino-wiring

// compute crc:
// 'COMMAND'.split('').reduce((p, n) => p ^ n.charCodeAt(0), 0).toString(16)

var PMTK_ACK = '$PMTK001'
var PMTK_TEST = '$PMTK000*32'
var PMTK_CMD_STANDBY_MODE = '$PMTK161,0*28'

var PMTK_SET_NMEA_BAUDRATE_9600 =   '$PMTK251,9600*17'
var PMTK_SET_NMEA_BAUDRATE_14400 =  '$PMTK251,14400*29'
var PMTK_SET_NMEA_BAUDRATE_19200 =  '$PMTK251,19200*22'
var PMTK_SET_NMEA_BAUDRATE_38400 =  '$PMTK251,38400*27'
var PMTK_SET_NMEA_BAUDRATE_57600 =  '$PMTK251,57600*2C'
var PMTK_SET_NMEA_BAUDRATE_115200 = '$PMTK251,115200*1F'

var baudRates = [
  9600,
  14400,
  19200,
  38400,
  57600,
  115200
]

var PMTK_SET_NMEA_BAUDRATE = {
  baudRate: 115200,
  command: PMTK_SET_NMEA_BAUDRATE_115200
}

// fix rate
var PMTK_SET_NMEA_UPDATERATE_100_MILLIHERTZ = '$PMTK220,10000*2F'
var PMTK_SET_NMEA_UPDATERATE_200_MILLIHERTZ = '$PMTK220,5000*1B'
var PMTK_SET_NMEA_UPDATERATE_1HZ =            '$PMTK220,1000*1F'
var PMTK_SET_NMEA_UPDATERATE_2HZ =            '$PMTK220,500*2B'
var PMTK_SET_NMEA_UPDATERATE_5HZ =            '$PMTK220,200*2C'
var PMTK_SET_NMEA_UPDATERATE_10HZ =           '$PMTK220,100*2F'

// what to output
var PMTK_API_SET_NMEA_OUTPUT_OFF =     '$PMTK314,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28'
var PMTK_API_SET_NMEA_OUTPUT_RMCONLY = '$PMTK314,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*29'
var PMTK_API_SET_NMEA_OUTPUT_GGAONLY =  '$PMTK314,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*29'
var PMTK_API_SET_NMEA_OUTPUT_RMCGGA =  '$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28'
var PMTK_API_SET_NMEA_OUTPUT_ALLDATA = '$PMTK314,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0*28'

module.exports = class AdafruitUltimateGps extends UartDevice {
  constructor (config) {
    super({
      device: config.gps.device,
      baudRate: config.gps.baudRate || 9600,
      delimiter: '\r\n'
    })
    this.onnotification = this.onnotification.bind(this)
    this.ongpsStateChange = this.ongpsStateChange.bind(this)
    this.parser = new GpsParser()
    this.parser.on('data', this.ongpsStateChange)
  }

  _open (cb) {
    super._open(err => {
      if (err) return cb(err)
      var q = new Queue({ concurrency: 1 })
      // any byte sequence should wake the device
      // note that a short delay is required before
      // sending additional commands will work
      q.push(cb => this.send('wake', () => setTimeout(cb, 50)))
      q.push(this.negotiateBaudRate.bind(this, q, 0))
      q.push(cb => this.send(PMTK_SET_NMEA_UPDATERATE_10HZ, '$PMTK001', cb))
      q.push(cb => this.send(PMTK_API_SET_NMEA_OUTPUT_GGAONLY, '$PMTK001', cb))
      q.start(err => {
        if (err) return cb(err)
        this.on('notification', this.onnotification)
        cb()
        this.emit('open')
      })
    })
  }

  _close (cb) {
    this.removeListener('notification', this.onnotification)
    this.send(PMTK_CMD_STANDBY_MODE, PMTK_ACK, (err, res) => {
      super._close(err2 => {
        if (err && err2) {
          err = [err, err2]
        } else if (err2) {
          err = err2
        }
        cb(err)
        this.emit('close')
      })
    })
  }

  watchdog (cb) {
    super.watchdog(err => {
      if (err) return cb(err)
      this.send(PMTK_TEST, PMTK_ACK, err => {
        if (err) {
          cb(new Error('device unresponsive'))
        } else {
          cb()
        }
      })
    })
  }

  negotiateBaudRate (q, i, cb) {
    var baudRate = baudRates[i]
    this.setBaudRate(baudRate, err => {
      if (err) return cb(err)
      // note the device does not ack baud rate changes
      this.send(PMTK_SET_NMEA_BAUDRATE.command, () => {
        setTimeout(() => {
          this.setBaudRate(PMTK_SET_NMEA_BAUDRATE.baudRate, err => {
            if (err) return cb(err)
            this.send(PMTK_TEST, PMTK_ACK, err => {
              if (err) {
                if (++i === baudRates.length) {
                  cb(new Error('device unresponsive at all baud rates'))
                  return
                }
                q.unshift(this.findAndSetBaudRate.bind(this, q, i))
              }
              cb()
            })
          })
        }, 50)
      })
    })
  }

  onnotification (evt) {
    // ignore incomplete packets
    if (evt[0] !== '$') return
    // ignore command packets
    if (evt.indexOf('$PMTK') === 0) return
    try {
      this.parser.update(evt)
    } catch (err) {
      this.emit('error', err)
    }
  }

  ongpsStateChange () {
    this.position = this.parser.state
    this.emit('change', {
      latitude: this.position.lat,
      longitude: this.position.lon,
      altitude: this.position.alt
    })
  }
}
