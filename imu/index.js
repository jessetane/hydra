module.exports = function (config) {
  return new (require('./' + config.imu.driver))(config)
}
