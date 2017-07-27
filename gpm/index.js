module.exports = function (config) {
  return new (require('./' + config.gpm.driver))(config)
}
