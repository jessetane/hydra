module.exports = function (config) {
  return new (require('./' + config.ptu.driver))(config)
}
