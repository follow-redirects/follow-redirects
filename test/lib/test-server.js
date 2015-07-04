// provides boilerplate for managing http and https servers during tests

var Promise = require('bluebird');
var http = require('http');
var https = require('https');
var assert = require('assert');

module.exports = function(defaultPorts) {
  defaultPorts = defaultPorts || {};
  var cache = [];

  function start(options) {
    return Promise.fromNode(function(callback) {
      if (typeof options === 'function') {
        options = {
          app: options
        };
      }
      assert(typeof options.app, 'function', 'app');
      var server, port;
      var protocol = options.protocol;
      if (!protocol || protocol.match(/^http(:)?$/)) {
        server = http.createServer(options.app);
        port = options.port || defaultPorts.http;
      } else if (protocol.match(/^https(:)?$/)) {
        server = https.createServer(options, options.app);
        port = options.port || defaultPorts.https;
      }
      assert(typeof port, 'number', 'port');
      addServer(server);
      server.listen(port, callback);
    });
  }

  function stop() {
    return Promise.all(cache.map(function(_stop){return _stop();})).finally(function(){
      cache = [];
    });
  }

  function addServer(server) {
    cache.push(function () {
      return Promise.fromNode(function(callback) {
        server.close(callback);
      });
    });
    return server;
  }

  return {
    start: start,
    stop: stop
  };
};
