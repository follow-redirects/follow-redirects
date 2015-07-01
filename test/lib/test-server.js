// provides boilerplate for managing http and https servers during tests

module.exports = {
  start: start,
  stop: stop
};

var Promise = require('bluebird');

var protos = {
  http :require('http'),
  https: require('https')
};

var servers = {};

function start(app, proto){
  return Promise.fromNode(function (callback) {
    proto = proto || 'http';
    servers[proto] = protos[proto].createServer(app);
    servers[proto].listen(3600, callback);
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