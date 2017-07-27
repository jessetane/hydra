module.exports = function (config) {
  return new (require('./' + config.gps.driver))(config)
}
