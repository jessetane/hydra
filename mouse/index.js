module.exports = function (config) {
  return new (require('./' + config.mouse.driver))(config)
}
