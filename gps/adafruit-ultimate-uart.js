var UartDevice = require('../uart-device')
var GpsParser = require('gps')

module.exports = class Gps extends UartDevice {
  constructor (config) {
    super()
    this.onnotification = this.onnotification.bind(this)
    this.ongpsStateChange = this.ongpsStateChange.bind(this)
    this.baudRate = config.gps.baudRate
    this.separator = '\r\n'
    this.gpsParser = new GpsParser()
  }

  open () {
    super.open()
    this.on('notification', this.onnotification)
    this.gpsParser.on('data', this.ongpsStateChange)
  }

  close () {
    this.removeListener('notification', this.onnotification)
    this.gpsParser.removeListener('data', this.ongpsStateChange)
    super.close()
  }

  onnotification (evt) {
    this.gpsParser.update(evt)
  }

  ongpsStateChange () {
    this.state = this.gpsParser.state
    this.emit('change')
  }
}
