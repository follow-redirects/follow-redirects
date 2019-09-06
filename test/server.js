// provides boilerplate for managing http and https servers during tests

var http = require("http");
var https = require("https");
var net = require("net");
var url = require("url");

module.exports = function (defaultPorts) {
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
      // Create server
      var app = typeof options === "function" ? options : options.app;
      var isHttps = /^https/.test(options.protocol || "http");
      var server = !isHttps ? http.createServer(app) : https.createServer(options, app);
      servers.push(server);

      // Set up CONNECT functionality
      server.on("connect", (req, clientSocket, head) => {
        var remote = url.parse("http://" + req.url);
        var remoteSocket = net.connect(remote.port, remote.hostname, function () {
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n" +
                              "Proxy-agent: Test proxy\r\n" +
                              "\r\n");
          remoteSocket.write(head);
          remoteSocket.pipe(clientSocket);
          clientSocket.pipe(remoteSocket);
        });
      });

      // Start the server
      var port = options.port || (isHttps ? defaultPorts.https : defaultPorts.http);
      server.listen(port, function (error) {
        return error ? reject(error) : resolve();
      });
    });
  }

  /**
   * Stops all the currently running servers previously created with `start`
   * @returns {Promise} that resolves when all servers have successfully shut down.
   */
  function stop() {
    return Promise.all(servers.map(stopServer)).then(clearServers);
  }

  function stopServer(server) {
    return new Promise(function (resolve, reject) {
      server.close(function (error) {
        return error ? reject(error) : resolve();
      });
    });
  }

  function clearServers() {
    servers = [];
  }

  return { start: start, stop: stop };
};
