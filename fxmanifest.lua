fx_version 'cerulean'

games { 'gta5' }

dependency 'webpack'
dependency 'yarn'

webpack_config 'client.config.js'
--
client_script 'dist/client.js'
server_script 'dist/server.js'
