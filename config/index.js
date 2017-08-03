var minimist = require('minimist')
var os = require('os')

// parse arguments
var args = minimist(process.argv.slice(2))

// parse configuration file
var config = null
var configFile = args.c || args.config
if (configFile) {
  config = require(
    configFile[0] !== '/'
      ? `${process.cwd()}/${configFile}`
      : configFile
  )
} else {
  try {
    config = require(
      os.homedir() + '/.hydra.json'
    )
  } catch (err) {
    config = require('/etc/hydra/config.json')
  }
}

// attach args
config.args = args

module.exports = config
