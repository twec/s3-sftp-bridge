var isJSON = require('is-json');
var conf = require('aws-lambda-config');

var envVarName = 'CONFIG';

exports.getConfig = function(context, callback) {
  var data = process.env[envVarName];
  if (isJSON(data)) {
    return callback(null, JSON.parse(data));
  }
  conf.getConfig(envVarName, callback);
};
