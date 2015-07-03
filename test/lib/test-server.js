// provides boilerplate for managing http and https servers during tests

var Promise = require('bluebird');
var http = require('http');
var https = require('https');
var fs = require('fs');
var semver = require('semver');

var servers = {};

var httpsOptions = {
  //ca : [fs.readFileSync(__dirname + '/TestCA.crt')],
  cert: fs.readFileSync(__dirname + '/TestServer.crt'),
  key: fs.readFileSync(__dirname + '/TestServer.pem')
};

var serverPorts = {
  http: 3600,
  https: 3601
};

function start(app, proto) {
  proto = proto || 'http';
  if (proto !== 'http' && proto !== 'https') {
    throw new Error('proto must be null, http, or https. got: ' + proto);
  }
  return Promise.fromNode(function(callback) {
    if (proto === 'http') {
      servers[proto] = http.createServer(app);
    }  else {
      servers[proto] = https.createServer(httpsOptions, app);
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

function addClientCerts(opts) {
  if (semver.lt(process.version, '0.9.0')) {
    // Can't figure out on certs on node < 0.9. Just giving up
    opts.rejectUnauthorized = false;
    opts.agent = new https.Agent(opts);
  } else {
    opts.agent = false;
    opts.ca = [fs.readFileSync(__dirname + '/TestCA.crt')];
    opts.cert = fs.readFileSync(__dirname + '/TestClient.crt');
    opts.key = fs.readFileSync(__dirname + '/TestClient.pem');
  }
}

module.exports = {
  start: start,
  stop: stop,
  addClientCerts: addClientCerts
};
