// provides boilerplate for managing http and https servers during tests

var http = require("http");
var https = require("https");
var assert = require("assert");

module.exports = function (defaultPorts) {
  // set default ports for each protocol i.e. {http: 80, https: 443}
  defaultPorts = defaultPorts || {};
  var servers = [];

  /**
   * Starts a server
   *
   * If options is a function, uses that the request handler for a `http` server on the default port.
   * options.protocol - the protocol to use (`http` or `https`). Defaults to `http`.
   * options.port - the port to use, will fall back to defaultPorts[protocol].
   * options.app - the request handler passed to http|https.createServer
   *
   * the options object will also be passed to as the https config for https servers
   *
   * @param options
   * @returns {Promise} that resolves when the server successfully started
   */
  function start(options) {
    return new Promise(function (resolve, reject) {
      if (typeof options === "function") {
        options = { app: options };
      }
      assert(typeof options.app, "function", "app");
      var server;
      var port;
      var protocol = options.protocol;
      if (!protocol || protocol.trim().match(/^http(:)?$/)) {
        server = http.createServer(options.app);
        port = options.port || defaultPorts.http;
      }
      else if (protocol.trim().match(/^https(:)?$/)) {
        server = https.createServer(options, options.app);
        port = options.port || defaultPorts.https;
      }
      assert(typeof port, "number", "port");
      servers.push(server);
      server.listen(port, function (err) {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  /**
   * Stops all the currently running servers previously created with `start`
   * @returns {Promise} that resolves when all servers have successfully shut down.
   */
  function stop() {
    // the empty .catch() block allows the next .then() to act like a finally()
    // once Node.js < 8 is dropped, this can be simplified
    return Promise.all(servers.map(stopServer))
      .catch(function () { /* do nothing */ })
      .then(clearServers);
  }

  function stopServer(server) {
    return new Promise(function (resolve, reject) {
      server.close(function (err) {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  function clearServers() {
    servers = [];
  }

  return { start: start, stop: stop };
};
