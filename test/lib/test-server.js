// provides boilerplate for managing http and https servers during tests

var Promise = require('bluebird');
var http = require('http');
var https = require('https');
var fs = require('fs');

var servers = {};

var httpsOptions = {
  ca : [fs.readFileSync(__dirname + '/testing-CA.crt')],
  cert: fs.readFileSync(__dirname + '/testing-server.crt'),
  key: fs.readFileSync(__dirname + '/testing-server.pem')
};

var serverPorts = {
  http: 3600,
  https: 3601
};

function start(app, proto){
  proto = proto || 'http';
  if (proto !== 'http' && proto !== 'https') {
    throw new Error('proto must be null, http, or https. got: ' + proto);
  }
  return Promise.fromNode(function (callback) {
    servers[proto] = proto === 'http' ? http.createServer(app) : https.createServer(httpsOptions, app);
    servers[proto].listen(serverPorts[proto], callback);
  });
}

function stop() {
  return Promise.all([_stop('http'), _stop('https')]);
}

function _stop(proto) {
  if(!servers[proto]) {
    return Promise.resolve(proto + ' not running');
  }
  return Promise.fromNode(function (callback) {
    servers[proto].close(callback);
    servers[proto] = null;
  });
}

function addClientCerts(opts) {
  opts.agent = false;
  opts.rejectUnauthorized = false;

  // TODO: Add custom CA to whitelist and set `rejectUnauthrized` back to true
  // the following does not work
  //opts.ca = fs.readFileSync(__dirname + '/testing-CA.crt');
  //opts.cert = fs.readFileSync(__dirname + '/testing-client.crt');
  //opts.key = fs.readFileSync(__dirname + '/testing-client.pem');
}

module.exports = {
  start: start,
  stop: stop,
  addClientCerts: addClientCerts
};