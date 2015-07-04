// provides boilerplate for managing http and https servers during tests

var Promise = require('bluebird');
var http = require('http');
var https = require('https');
var config = require('./https-config');

var servers = {};

var serverPorts = {
  http: 3600,
  https: 3601
};

function start(app, proto, httpsOptions) {
  proto = proto || 'http';
  if (proto !== 'http' && proto !== 'https') {
    throw new Error('proto must be null, http, or https. got: ' + proto);
  }
  return Promise.fromNode(function(callback) {
    if (proto === 'http') {
      servers[proto] = http.createServer(app);
    }  else {
      servers[proto] = https.createServer(config.addServerOptions({}), app);
    }
    servers[proto].listen(serverPorts[proto], callback);
  });
}

function stop() {
  return Promise.all([_stop('http'), _stop('https')]);
}

function _stop(proto) {
  if (!servers[proto]) {
    return Promise.resolve(proto + ' not running');
  }
  return Promise.fromNode(function(callback) {
    servers[proto].close(callback);
    servers[proto] = null;
  });
}

module.exports = {
  start: start,
  stop: stop
};
