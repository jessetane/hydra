module.exports = function (config) {
  return new (require('./' + config.joystick.driver))(config)
}
