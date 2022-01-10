var express = require("express");
var assert = require("assert");
var net = require("net");
var server = require("./server")({ https: 3601, http: 3600 });
var url = require("url");
var followRedirects = require("..");
var http = followRedirects.http;
var https = followRedirects.https;
var fs = require("fs");
var path = require("path");
var lolex = require("lolex");

var util = require("./util");
var concat = require("concat-stream");
var concatJson = util.concatJson;
var delay = util.delay;
var redirectsTo = util.redirectsTo;
var sendsJson = util.sendsJson;
var asPromise = util.asPromise;

var testFile = path.resolve(__dirname, "assets/input.txt");
var testFileBuffer = fs.readFileSync(testFile);
var testFileString = testFileBuffer.toString();

var nodeMajorVersion = Number.parseInt(process.version.match(/\d+/)[0], 10);

describe("follow-redirects", function () {
  function httpsOptions(app) {
    return {
      app: app,
      protocol: "https",
      cert: fs.readFileSync(path.resolve(__dirname, "assets/localhost.crt")),
      key: fs.readFileSync(path.resolve(__dirname, "assets/localhost.key")),
    };
  }
  var ca = fs.readFileSync(path.resolve(__dirname, "assets/ca.crt"));

  var app;
  var app2;
  var originalMaxRedirects;
  var originalMaxBodyLength;

  beforeEach(function () {
    originalMaxRedirects = followRedirects.maxRedirects;
    originalMaxBodyLength = followRedirects.maxBodyLength;
    app = express();
    app2 = express();
  });

  afterEach(function () {
    followRedirects.maxRedirects = originalMaxRedirects;
    followRedirects.maxBodyLength = originalMaxBodyLength;
    return server.stop();
  });

  it("http.get with string and callback - redirect", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", redirectsTo("/d"));
    app.get("/d", redirectsTo("/e"));
    app.get("/e", redirectsTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("http.get with URL object and callback - redirect", function () {
    if (nodeMajorVersion < 10) {
      this.skip();
    }

    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", redirectsTo("/d"));
    app.get("/d", redirectsTo("/e"));
    app.get("/e", redirectsTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get(
          new URL("http://localhost:3600/a"),
          concatJson(resolve, reject)
        ).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("http.get with options object and callback - redirect", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", redirectsTo("/d"));
    app.get("/d", redirectsTo("/e"));
    app.get("/e", redirectsTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var options = {
          hostname: "localhost",
          port: 3600,
          path: "/a",
          method: "GET",
        };
        http.get(options, concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("http.get with string and callback - no redirect", function () {
    app.get("/a", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
      });
  });

  it("http.get with options object and callback - no redirect", function () {
    app.get("/a", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var options = {
          hostname: "localhost",
          port: 3600,
          path: "/a?xyz",
          method: "GET",
        };
        http.get(options, concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a?xyz");
      });
  });

  it("http.get with host option and callback - redirect", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", redirectsTo("/d"));
    app.get("/d", redirectsTo("/e"));
    app.get("/e", redirectsTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var options = {
          host: "localhost",
          port: 3600,
          path: "/a",
          method: "GET",
        };
        http.get(options, concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("http.get with response event", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", redirectsTo("/d"));
    app.get("/d", redirectsTo("/e"));
    app.get("/e", redirectsTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a")
          .on("response", concatJson(resolve, reject))
          .on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("should return with the original status code if the response does not contain a location header", function () {
    app.get("/a", function (req, res) {
      res.status(307).end();
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", resolve).on("error", reject);
      }))
      .then(function (res) {
        assert.equal(res.statusCode, 307);
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        res.on("data", function () {
          // noop to consume the stream (server won't shut down otherwise).
        });
      });
  });

  it("should emit connection errors on the returned stream", function () {
    app.get("/a", redirectsTo("http://localhost:36002/b"));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", reject).on("error", resolve);
      }))
      .then(function (error) {
        assert.equal(error.code, "ECONNREFUSED");
      });
  });

  it("should emit socket events on the returned stream", function () {
    app.get("/a", sendsJson({ a: "b" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a")
          .on("socket", resolve)
          .on("error", reject);
      }))
      .then(function (socket) {
        assert(socket instanceof net.Socket, "socket event should emit with socket");
      });
  });

  it("should emit connect events on the returned stream", function () {
    app.get("/a", sendsJson({ a: "b" }));

    var req;
    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        req = http.get("http://localhost:3600/a");
        req.on("connect", function (response, socket, head) {
          resolve({ response: response, socket: socket, head: head });
        });
        req.on("error", reject);
        req._currentRequest.emit("connect", "r", "s", "h");
      }))
      .then(function (args) {
        req.abort();
        assert.equal(args.response, "r");
        assert.equal(args.socket, "s");
        assert.equal(args.head, "h");
      });
  });

  it("emits an error on redirects with an invalid location", function () {
    if (nodeMajorVersion < 10) {
      this.skip();
    }

    app.get("/a", function (req, res) {
      // Explictly send response with invalid Location header
      res.socket.write("HTTP/1.1 301 Moved Permanently\n");
      res.socket.write("Location: http://смольный-институт.рф\n");
      res.socket.write("\n");
      res.socket.end();
    });

    return server.start(app)
      .then(asPromise(function (resolve) {
        http.get("http://localhost:3600/a").on("error", resolve);
      }))
      .then(function (error) {
        assert(error instanceof Error);
        assert.equal(error.code, "ERR_FR_REDIRECTION_FAILURE");
        assert(error.cause instanceof Error);
        switch (error.cause.code) {
        // Node 17+
        case "ERR_INVALID_URL":
          assert.equal(error.message, "Redirected request failed: Invalid URL");
          break;
        // Older Node versions
        case "ERR_UNESCAPED_CHARACTERS":
          assert.equal(error.message, "Redirected request failed: Request path contains unescaped characters");
          break;
        default:
          throw new Error("Unexpected error code " + error.code);
        }
      });
  });

  it("emits an error whem url.resolve fails", function () {
    app.get("/a", redirectsTo("/b"));
    var urlResolve = url.resolve;
    url.resolve = function () {
      throw new Error();
    };

    return server.start(app)
      .then(asPromise(function (resolve) {
        http.get("http://localhost:3600/a").on("error", resolve);
      }))
      .then(function (error) {
        url.resolve = urlResolve;
        assert.equal(error.code, "ERR_FR_REDIRECTION_FAILURE");
      });
  });

  it("emits an error when the request fails for another reason", function () {
    app.get("/a", function (req, res) {
      res.socket.write("HTTP/1.1 301 Moved Permanently\n");
      res.socket.write("Location: other\n");
      res.socket.write("\n");
      res.socket.end();
    });

    return server.start(app)
      .then(asPromise(function (resolve) {
        var request = http.get("http://localhost:3600/a");
        request._performRequest = function () {
          throw new Error("custom");
        };
        request.on("error", resolve);
      }))
      .then(function (error) {
        assert(error instanceof Error);
        assert.equal(error.message, "Redirected request failed: custom");
      });
  });

  describe("setTimeout", function () {
    var clock;
    beforeEach(function () {
      clock = lolex.install();
    });
    afterEach(function () {
      clock.uninstall();
    });

    it("clears timeouts after a successful response", function () {
      app.get("/redirect", redirectsTo("/timeout"));
      app.get("/timeout", delay(clock, 2000, sendsJson({ didnot: "timeout" })));

      var req;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          req = http.get("http://localhost:3600/redirect", concatJson(resolve, reject));
          req.on("error", reject);
          req.setTimeout(3000, function () {
            throw new Error("should not have timed out");
          });
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { didnot: "timeout" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/timeout");
          clock.tick(5000);
        });
    });

    it("clears timeouts after an error response", function () {
      app.get("/redirect", redirectsTo("http://localhost:3602/b"));

      var req;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          req = http.get("http://localhost:3600/redirect", reject);
          req.setTimeout(3000, function () {
            throw new Error("should not have timed out");
          });
          req.on("error", resolve);
        }))
        .then(function (error) {
          assert.equal(error.code, "ECONNREFUSED");
          clock.tick(5000);
        });
    });

    it("handles errors occuring before a socket is established", function () {
      app.get("/redirect", redirectsTo("http://localhost:3602/b"));

      var req;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          req = http.get("http://localhost:3600/redirect", reject);
          req.setTimeout(3000, function () {
            throw new Error("should not have timed out");
          });
          req.emit("error", new Error());
          req.on("error", resolve);
        }))
        .then(function (error) {
          assert.equal(error.code, "ECONNREFUSED");
          clock.tick(5000);
        });
    });

    it("sets a timeout when the socket already exists", function () {
      app.get("/timeout", delay(clock, 5000, sendsJson({ timed: "out" })));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.get("http://localhost:3600/timeout", function () {
            throw new Error("should have timed out");
          });
          req.on("error", reject);
          req.on("socket", function () {
            assert(req.socket instanceof net.Socket);
            req.setTimeout(3000, function () {
              req.abort();
              resolve();
            });
          });
        }));
    });

    it("destroys the socket after configured inactivity period", function () {
      app.get("/data", delay(clock, 3000, sendsJson({ took: "toolongtosenddata" })));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.get("http://localhost:3600/data", concatJson(reject, reject));
          req.on("error", reject);
          req.setTimeout(100, function () {
            throw new Error("should not have timed out");
          });
          req.on("socket", function () {
            req.socket.on("timeout", function () {
              resolve();
            });
          });
        }));
    });

    it("should timeout on the final request", function () {
      app.get("/redirect1", redirectsTo("/redirect2"));
      app.get("/redirect2", redirectsTo("/timeout"));
      app.get("/timeout", delay(clock, 5000, sendsJson({ timed: "out" })));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.get("http://localhost:3600/redirect1", function () {
            throw new Error("should have timed out");
          });
          req.on("error", reject);
          req.setTimeout(1000, function () {
            req.abort();
            resolve();
          });
        }));
    });

    it("should include redirect delays in the timeout", function () {
      app.get("/redirect1", delay(clock, 1000, redirectsTo("/redirect2")));
      app.get("/redirect2", delay(clock, 1000, redirectsTo("/redirect3")));
      app.get("/redirect3", delay(clock, 1000, "/timeout"));
      app.get("/timeout", delay(clock, 1000, sendsJson({ timed: "out" })));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.get("http://localhost:3600/redirect1", function () {
            throw new Error("should have timed out");
          });
          req.on("error", reject);
          req.setTimeout(2000, function () {
            req.abort();
            resolve();
          });
        }));
    });

    it("overrides existing timeouts", function () {
      app.get("/redirect", redirectsTo("/timeout"));
      app.get("/timeout", delay(clock, 5000, sendsJson({ timed: "out" })));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.get("http://localhost:3600/redirect", function () {
            throw new Error("should have timed out");
          });
          req.on("error", reject);

          var callbacks = 0;
          function timeoutCallback() {
            if (++callbacks === 3) {
              req.abort();
              resolve(callbacks);
            }
          }
          req.setTimeout(10000, timeoutCallback);
          req.setTimeout(10000, timeoutCallback);
          req.setTimeout(1000, timeoutCallback);
        }));
    });
  });

  it("should follow redirects over https", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", sendsJson({ baz: "quz" }));

    return server.start(httpsOptions(app))
      .then(asPromise(function (resolve, reject) {
        var opts = url.parse("https://localhost:3601/a");
        opts.ca = ca;
        https.get(opts, concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { baz: "quz" });
        assert.deepEqual(res.responseUrl, "https://localhost:3601/c");
      });
  });

  it("should destroy responses", function () {
    app.get("/a", hangingRedirectTo("/b"));
    app.get("/b", hangingRedirectTo("/c"));
    app.get("/c", hangingRedirectTo("/d"));
    app.get("/d", hangingRedirectTo("/e"));
    app.get("/e", hangingRedirectTo("/f"));
    app.get("/f", sendsJson({ a: "b" }));

    function hangingRedirectTo(destination) {
      return function (req, res) {
        res.writeHead(301, { location: destination });
        res.write(new Array(128).join(" "));
      };
    }

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { a: "b" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/f");
      });
  });

  it("should honor query params in redirects", function () {
    app.get("/a", redirectsTo("/b?greeting=hello"));
    app.get("/b", function (req, res) {
      res.json({ greeting: req.query.greeting });
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        http.get("http://localhost:3600/a", concatJson(resolve, reject)).on("error", reject);
      }))
      .then(function (res) {
        assert.deepEqual(res.parsedJson, { greeting: "hello" });
        assert.deepEqual(res.responseUrl, "http://localhost:3600/b?greeting=hello");
      });
  });

  it("should allow aborting", function () {
    var request;

    app.get("/a", redirectsTo("/b"));
    app.get("/b", redirectsTo("/c"));
    app.get("/c", function () {
      request.abort();
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var currentTime = Date.now();
        request = http.get("http://localhost:3600/a", resolve);
        assert(request.aborted === false || // Node >= v11.0.0
               typeof request.aborted === "undefined"); // Node < v11.0.0
        request.on("response", reject);
        request.on("error", reject);
        request.on("abort", onAbort);
        function onAbort() {
          assert(request.aborted === true || // Node >= v11.0.0
                 typeof request.aborted === "number" &&
                   request.aborted > currentTime); // Node < v11.0.0
          request.removeListener("error", reject);
          request.on("error", noop);
          resolve();
        }
      }));
  });

  it("should provide connection", function () {
    var request;

    app.get("/a", sendsJson({}));

    return server.start(app)
      .then(asPromise(function (resolve) {
        request = http.get("http://localhost:3600/a", resolve);
      }))
      .then(function () {
        assert(request.connection instanceof net.Socket);
      });
  });

  it("should provide flushHeaders", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", sendsJson({ foo: "bar" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var request = http.get("http://localhost:3600/a", resolve);
        request.flushHeaders();
        request.on("error", reject);
      }));
  });

  it("should provide getHeader", function () {
    var req = http.request("http://localhost:3600/a");
    req.setHeader("my-header", "my value");
    assert.equal(req.getHeader("my-header"), "my value");
    req.abort();
  });

  it("should provide removeHeader", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", function (req, res) {
      res.end(JSON.stringify(req.headers));
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", concatJson(resolve, reject));
        req.setHeader("my-header", "my value");
        assert.equal(req.getHeader("my-header"), "my value");
        req.removeHeader("my-header");
        assert.equal(req.getHeader("my-header"), undefined);
        req.end();
      }))
      .then(function (res) {
        var headers = res.parsedJson;
        assert.equal(headers["my-header"], undefined);
      });
  });

  it("should provide setHeader", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", function (req, res) {
      res.end(JSON.stringify(req.headers));
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", concatJson(resolve, reject));
        req.setHeader("my-header", "my value");
        assert.equal(req.getHeader("my-header"), "my value");
        req.end();
      }))
      .then(function (res) {
        var headers = res.parsedJson;
        assert.equal(headers["my-header"], "my value");
      });
  });

  it("should provide setNoDelay", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", sendsJson({ foo: "bar" }));

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var request = http.get("http://localhost:3600/a", resolve);
        request.setNoDelay(true);
        request.on("error", reject);
      }));
  });

  it("should provide setSocketKeepAlive", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", sendsJson({ foo: "bar" }));

    return server.start(app)
      .then(asPromise(function (resolve) {
        var request = http.get("http://localhost:3600/a", resolve);
        request.setSocketKeepAlive(true);
      }));
  });

  it("should provide setTimeout", function () {
    app.get("/a", redirectsTo("/b"));
    app.get("/b", sendsJson({ foo: "bar" }));

    return server.start(app)
      .then(asPromise(function (resolve) {
        var request = http.get("http://localhost:3600/a", resolve);
        request.setTimeout(1000);
      }));
  });

  it("should provide socket", function () {
    var request;

    app.get("/a", sendsJson({}));

    return server.start(app)
      .then(asPromise(function (resolve) {
        request = http.get("http://localhost:3600/a", resolve);
      }))
      .then(function () {
        assert(request.socket instanceof net.Socket);
      });
  });

  describe("should obey a `maxRedirects` property", function () {
    beforeEach(function () {
      var i = 22;
      while (i > 0) {
        app.get("/r" + i, redirectsTo("/r" + --i));
      }
      app.get("/r0", sendsJson({ foo: "bar" }));
    });

    it("which defaults to 21", function () {
      return server.start(app)
        // 21 redirects should work fine
        .then(asPromise(function (resolve, reject) {
          http.get("http://localhost:3600/r21", concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { foo: "bar" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/r0");
        })
        // 22 redirects should fail
        .then(asPromise(function (resolve, reject) {
          http.get("http://localhost:3600/r22", reject).on("error", resolve);
        }))
        .then(function (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_FR_TOO_MANY_REDIRECTS");
          assert.equal(error.message, "Maximum number of redirects exceeded");
        });
    });

    it("which can be set globally", function () {
      followRedirects.maxRedirects = 22;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          http.get("http://localhost:3600/r22", concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { foo: "bar" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/r0");
        });
    });

    it("set as an option on an individual request", function () {
      var u = url.parse("http://localhost:3600/r2");
      u.maxRedirects = 1;

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          http.get(u, reject).on("error", resolve);
        }))
        .then(function (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_FR_TOO_MANY_REDIRECTS");
          assert.equal(error.message, "Maximum number of redirects exceeded");
        });
    });
  });

  describe("the trackRedirects option", function () {
    beforeEach(function () {
      app.get("/a", redirectsTo("/b"));
      app.get("/b", redirectsTo("/c"));
      app.get("/c", sendsJson({}));
    });

    describe("when not set", function () {
      it("should not track redirects", function () {
        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            var opts = url.parse("http://localhost:3600/a");
            http.get(opts, concatJson(resolve, reject)).on("error", reject);
          }))
          .then(function (res) {
            var redirects = res.redirects;
            assert.equal(redirects.length, 0);
          });
      });
    });

    describe("when set to true", function () {
      it("should track redirects", function () {
        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            var opts = url.parse("http://localhost:3600/a");
            opts.trackRedirects = true;
            http.get(opts, concatJson(resolve, reject)).on("error", reject);
          }))
          .then(function (res) {
            var redirects = res.redirects;
            assert.equal(redirects.length, 3);

            assert.equal(redirects[0].url, "http://localhost:3600/a");
            assert.equal(redirects[0].statusCode, 302);
            assert.equal(redirects[0].headers["content-type"], "text/plain; charset=utf-8");

            assert.equal(redirects[1].url, "http://localhost:3600/b");
            assert.equal(redirects[1].statusCode, 302);
            assert.equal(redirects[1].headers["content-type"], "text/plain; charset=utf-8");

            assert.equal(redirects[2].url, "http://localhost:3600/c");
            assert.equal(redirects[2].statusCode, 200);
            assert.equal(redirects[2].headers["content-type"], "application/json; charset=utf-8");
          });
      });
    });
  });

  describe("should switch to safe methods when appropriate", function () {
    function itChangesMethod(statusCode, postToGet, changeAll) {
      describe("when redirecting with status code " + statusCode, function () {
        itRedirectsWith(statusCode, "GET", "GET");
        itRedirectsWith(statusCode, "HEAD", "HEAD");
        itRedirectsWith(statusCode, "POST", postToGet ? "GET" : "POST");
        itRedirectsWith(statusCode, "PUT", changeAll ? "GET" : "PUT");
        itRedirectsWith(statusCode, "DELETE", changeAll ? "GET" : "DELETE");
      });
    }

    function itRedirectsWith(statusCode, originalMethod, redirectedMethod) {
      var description = "should " +
          (originalMethod === redirectedMethod ? "reuse " + originalMethod :
            "switch from " + originalMethod + " to " + redirectedMethod);
      it(description, function () {
        app[originalMethod.toLowerCase()]("/a", redirectsTo(statusCode, "/b"));
        app[redirectedMethod.toLowerCase()]("/b", sendsJson({ a: "b" }));

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            var opts = url.parse("http://localhost:3600/a");
            opts.method = originalMethod;
            http.request(opts, resolve).on("error", reject).end();
          }))
          .then(function (res) {
            assert.deepEqual(res.responseUrl, "http://localhost:3600/b");
            if (res.statusCode !== 200) {
              throw new Error("Did not use " + redirectedMethod);
            }
          });
      });
    }

    itChangesMethod(300, false);
    itChangesMethod(301, true);
    itChangesMethod(302, true);
    itChangesMethod(303, true, true);
    itChangesMethod(307, false);
  });

  describe("should handle cross protocol redirects ", function () {
    it("(https -> http -> https)", function () {
      app.get("/a", redirectsTo("http://localhost:3600/b"));
      app2.get("/b", redirectsTo("https://localhost:3601/c"));
      app.get("/c", sendsJson({ yes: "no" }));

      return Promise.all([server.start(httpsOptions(app)), server.start(app2)])
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("https://localhost:3601/a");
          opts.ca = ca;
          https.get(opts, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { yes: "no" });
          assert.deepEqual(res.responseUrl, "https://localhost:3601/c");
        });
    });

    it("(http -> https -> http)", function () {
      app.get("/a", redirectsTo("https://localhost:3601/b"));
      app2.get("/b", redirectsTo("http://localhost:3600/c"));
      app.get("/c", sendsJson({ hello: "goodbye" }));

      return Promise.all([server.start(app), server.start(httpsOptions(app2))])
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("http://localhost:3600/a");
          opts.ca = ca;
          http.get(opts, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { hello: "goodbye" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/c");
        });
    });
  });

  describe("should error on an unsupported protocol redirect", function () {
    it("(http -> about)", function () {
      app.get("/a", redirectsTo("about:blank"));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          http.get("http://localhost:3600/a")
            .on("response", function () { return reject(new Error("unexpected response")); })
            .on("error", reject);
        }))
        .catch(function (error) {
          assert(error instanceof Error);
          assert(error instanceof TypeError);
          assert.equal(error.message, "Unsupported protocol about:");
        });
    });
  });

  it("should wait for an explicit call to end", function () {
    var redirected = false;
    app.post("/a", redirectsTo(307, "http://localhost:3600/b"));
    app.post("/b", redirectsTo(307, "http://localhost:3600/c"));
    app.post("/c", redirectsTo(307, "http://localhost:3600/d"));
    app.post("/d", function (req, res) {
      redirected = true;
      req.pipe(res);
    });

    var req;

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
        req.write(testFileString);
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        assert(redirected);
        // If we can still write to the request, it wasn't closed yet
        req.write(testFileString);
        req.end();
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString + testFileString);
      });
  });

  it("errors on write after end", function () {
    app.post("/a", function (req, res) {
      req.pipe(res);
    });

    return server.start(app)
      .then(function () {
        var req = http.request("http://localhost:3600/a", { method: "POST" });
        req.write(testFileString);
        req.end();
        try {
          req.write(testFileString);
        }
        catch (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_STREAM_WRITE_AFTER_END");
          assert.equal(error.message, "write after end");
          return;
        }
        finally {
          req.abort();
        }
        throw new Error("no error");
      });
  });

  it("should support writing into request stream without redirects", function () {
    app.post("/a", function (req, res) {
      req.pipe(res);
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
        req.end(testFileBuffer, "buffer");
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  it("should support writing into request stream with redirects", function () {
    app.post("/a", redirectsTo(307, "http://localhost:3600/b"));
    app.post("/b", redirectsTo(307, "http://localhost:3600/c"));
    app.post("/c", redirectsTo(307, "http://localhost:3600/d"));
    app.post("/d", function (req, res) {
      req.pipe(res);
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
        req.end(testFileBuffer, "buffer");
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  it("should support piping into request stream without redirects", function () {
    app.post("/a", function (req, res) {
      req.pipe(res);
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
        fs.createReadStream(testFile).pipe(req);
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  it("should support piping into request stream with redirects", function () {
    app.post("/a", redirectsTo(307, "http://localhost:3600/b"));
    app.post("/b", redirectsTo(307, "http://localhost:3600/c"));
    app.post("/c", redirectsTo(307, "http://localhost:3600/d"));
    app.post("/d", function (req, res) {
      req.pipe(res);
    });

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
        fs.createReadStream(testFile).pipe(req);
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  it("should support piping into request stream with explicit Content-Length without redirects", function () {
    app.post("/a", function (req, res) {
      req.pipe(res);
    });

    var opts = url.parse("http://localhost:3600/a");
    opts.method = "POST";
    opts.headers = {
      "Content-Length": testFileBuffer.byteLength,
    };

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request(opts, resolve);
        fs.createReadStream(testFile).pipe(req);
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  it("should support piping into request stream with explicit Content-Length with redirects", function () {
    app.post("/a", redirectsTo(307, "http://localhost:3600/b"));
    app.post("/b", redirectsTo(307, "http://localhost:3600/c"));
    app.post("/c", redirectsTo(307, "http://localhost:3600/d"));
    app.post("/d", function (req, res) {
      req.pipe(res);
    });

    var opts = url.parse("http://localhost:3600/a");
    opts.method = "POST";
    opts.headers = {
      "Content-Length": testFileBuffer.byteLength,
    };

    return server.start(app)
      .then(asPromise(function (resolve, reject) {
        var req = http.request(opts, resolve);
        fs.createReadStream(testFile).pipe(req);
        req.on("error", reject);
      }))
      .then(asPromise(function (resolve, reject, res) {
        res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
      }))
      .then(function (str) {
        assert.equal(str, testFileString);
      });
  });

  describe("should obey a `maxBodyLength` property", function () {
    it("which defaults to 10MB", function () {
      assert.equal(followRedirects.maxBodyLength, 10 * 1024 * 1024);
    });

    it("set globally, on write", function () {
      app.post("/a", function (req, res) {
        req.pipe(res);
      });

      followRedirects.maxBodyLength = 8;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, reject);
          req.write("12345678");
          req.on("error", resolve);
          req.write("9");
        }))
        .then(function (error) {
          assert.equal(error.message, "Request body larger than maxBodyLength limit");
        });
    });

    it("set per request, on write", function () {
      app.post("/a", function (req, res) {
        req.pipe(res);
      });
      var opts = url.parse("http://localhost:3600/a");
      opts.method = "POST";
      opts.maxBodyLength = 8;

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request(opts, reject);
          req.write("12345678");
          req.on("error", resolve);
          req.write("9");
        }))
        .then(function (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_FR_MAX_BODY_LENGTH_EXCEEDED");
          assert.equal(error.message, "Request body larger than maxBodyLength limit");
        });
    });

    it("set globally, on end", function () {
      app.post("/a", function (req, res) {
        req.pipe(res);
      });

      followRedirects.maxBodyLength = 8;
      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, reject);
          req.write("12345678");
          req.on("error", resolve);
          req.end("9");
        }))
        .then(function (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_FR_MAX_BODY_LENGTH_EXCEEDED");
          assert.equal(error.message, "Request body larger than maxBodyLength limit");
        });
    });

    it("set per request, on end", function () {
      app.post("/a", function (req, res) {
        req.pipe(res);
      });
      var opts = url.parse("http://localhost:3600/a");
      opts.method = "POST";
      opts.maxBodyLength = 8;

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request(opts, reject);
          req.write("12345678");
          req.on("error", resolve);
          req.end("9");
        }))
        .then(function (error) {
          assert(error instanceof Error);
          assert.equal(error.code, "ERR_FR_MAX_BODY_LENGTH_EXCEEDED");
          assert.equal(error.message, "Request body larger than maxBodyLength limit");
        });
    });
  });

  describe("writing invalid data", function () {
    it("throws an error", function () {
      var req = http.request("http://example.org/");
      var error = null;
      try {
        req.write(12345678);
      }
      catch (e) {
        error = e;
      }
      req.abort();
      assert(error instanceof Error);
      assert(error instanceof TypeError);
      assert.equal(error.message, "data should be a string, Buffer or Uint8Array");
    });
  });

  describe("when switching from POST to GET", function () {
    it("should drop the entity and associated headers", function () {
      app.post("/a", redirectsTo(302, "http://localhost:3600/b"));
      app.get("/b", function (req, res) {
        res.write(JSON.stringify(req.headers));
        req.pipe(res); // will invalidate JSON if non-empty
      });

      var opts = url.parse("http://localhost:3600/a");
      opts.method = "POST";
      opts.headers = {
        "other": "value",
        "content-type": "application/javascript",
        "Content-Length": testFileBuffer.byteLength,
      };

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request(opts, resolve);
          fs.createReadStream(testFile).pipe(req);
          req.on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }))
        .then(function (str) {
          var body = JSON.parse(str);
          assert.equal(body.host, "localhost:3600");
          assert.equal(body.other, "value");
          assert.equal(body["content-type"], undefined);
          assert.equal(body["content-length"], undefined);
        });
    });
  });

  describe("when redirecting to a different host while the host header is set", function () {
    it("uses the new host header if redirect host is different", function () {
      app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
      app.get("/b", function (req, res) {
        res.write(JSON.stringify(req.headers));
        req.pipe(res); // will invalidate JSON if non-empty
      });

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("http://localhost:3600/a");
          opts.headers = { hOsT: "otherhost.com" };
          http.get(opts, resolve).on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.statusCode, 200);
          assert.deepEqual(res.responseUrl, "http://localhost:3600/b");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }))
        .then(function (str) {
          var body = JSON.parse(str);
          assert.equal(body.host, "localhost:3600");
        });
    });

    it("uses the location host if redirect host is the same", function () {
      app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
      app.get("/b", function (req, res) {
        res.write(JSON.stringify(req.headers));
        req.pipe(res); // will invalidate JSON if non-empty
      });

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("http://127.0.0.1:3600/a");
          opts.headers = { hOsT: "localhost:3600" };
          http.get(opts, resolve).on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.statusCode, 200);
          assert.deepEqual(res.responseUrl, "http://localhost:3600/b");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }))
        .then(function (str) {
          var body = JSON.parse(str);
          assert.equal(body.host, "localhost:3600");
        });
    });

    it("uses the existing host header if redirect host is relative", function () {
      app.get("/a", redirectsTo(302, "/b"));
      app.get("/b", function (req, res) {
        res.write(JSON.stringify(req.headers));
        req.pipe(res); // will invalidate JSON if non-empty
      });

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("http://127.0.0.1:3600/a");
          opts.headers = { hOsT: "localhost:3600" };
          http.get(opts, resolve).on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.statusCode, 200);
          assert.deepEqual(res.responseUrl, "http://localhost:3600/b");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }))
        .then(function (str) {
          var body = JSON.parse(str);
          assert.equal(body.host, "localhost:3600");
        });
    });
  });

  [
    "Authorization",
    "Cookie",
  ].forEach(function (header) {
    describe("when the client passes an header named " + header, function () {
      it("ignores it when null", function () {
        app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://127.0.0.1:3600/a");
        opts.headers = { host: "localhost" };
        opts.headers[header] = null;

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], undefined);
          });
      });

      it("keeps the header when redirected to the same host", function () {
        app.get("/a", redirectsTo(302, "/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://localhost:3600/a");
        opts.headers = {};
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], "the header value");
          });
      });

      it("keeps the header when redirected to the same host via header", function () {
        app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://127.0.0.1:3600/a");
        opts.headers = { host: "localhost:3600" };
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], "the header value");
          });
      });

      it("keeps the header when redirected to the same host via header", function () {
        app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://127.0.0.1:3600/a");
        opts.headers = { host: "localhost:3600" };
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], "the header value");
          });
      });

      it("keeps the header when redirected to a subdomain", function () {
        app.get("/a", redirectsTo(302, "http://sub.localhost:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://localhost:3600/a");
        opts.headers = {};
        opts.headers[header] = "the header value";

        // Intercept the hostname, as no DNS entry is defined for it
        opts.beforeRedirect = function (options) {
          assert.equal(options.hostname, "sub.localhost");
          options.hostname = "localhost";
        };

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], "the header value");
          });
      });

      it("drops the header when redirected to a different host (same hostname and different port)", function () {
        app.get("/a", redirectsTo(302, "http://localhost:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://127.0.0.1:3600/a");
        opts.headers = { host: "localhost" };
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "localhost:3600");
            assert.equal(body[header.toLowerCase()], undefined);
          });
      });

      it("drops the header when redirected to a different host", function () {
        app.get("/a", redirectsTo(302, "http://127.0.0.1:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://localhost:3600/a");
        opts.headers = {};
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "127.0.0.1:3600");
            assert.equal(body[header.toLowerCase()], undefined);
          });
      });

      it("drops the header when redirected from a different host via header", function () {
        app.get("/a", redirectsTo(302, "http://127.0.0.1:3600/b"));
        app.get("/b", function (req, res) {
          res.end(JSON.stringify(req.headers));
        });

        var opts = url.parse("http://127.0.0.1:3600/a");
        opts.headers = { host: "localhost" };
        opts.headers[header] = "the header value";

        return server.start(app)
          .then(asPromise(function (resolve, reject) {
            http.get(opts, resolve).on("error", reject);
          }))
          .then(asPromise(function (resolve, reject, res) {
            res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
          }))
          .then(function (str) {
            var body = JSON.parse(str);
            assert.equal(body.host, "127.0.0.1:3600");
            assert.equal(body[header.toLowerCase()], undefined);
          });
      });
    });
  });

  describe("when the followRedirects option is set to false", function () {
    it("does not redirect", function () {
      app.get("/a", redirectsTo(302, "/b"));
      app.get("/b", sendsJson({ a: "b" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("http://localhost:3600/a");
          opts.followRedirects = false;
          http.get(opts, resolve).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.statusCode, 302);
          assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        });
    });
  });

  describe("should choose the right agent per protocol", function () {
    it("(https -> http -> https)", function () {
      app.get("/a", redirectsTo("http://localhost:3600/b"));
      app2.get("/b", redirectsTo("https://localhost:3601/c"));
      app.get("/c", sendsJson({ yes: "no" }));

      var httpAgent = addRequestLogging(new http.Agent());
      var httpsAgent = addRequestLogging(new https.Agent());
      function addRequestLogging(agent) {
        agent._requests = [];
        agent._addRequest = agent.addRequest;
        agent.addRequest = function (request, options) {
          this._requests.push(options.path);
          this._addRequest(request, options);
        };
        return agent;
      }

      return Promise.all([server.start(httpsOptions(app)), server.start(app2)])
        .then(asPromise(function (resolve, reject) {
          var opts = url.parse("https://localhost:3601/a");
          opts.ca = ca;
          opts.agents = { http: httpAgent, https: httpsAgent };
          https.get(opts, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(httpAgent._requests, ["/b"]);
          assert.deepEqual(httpsAgent._requests, ["/a", "/c"]);
          assert.deepEqual(res.parsedJson, { yes: "no" });
          assert.deepEqual(res.responseUrl, "https://localhost:3601/c");
        });
    });
  });

  describe("should not hang on empty writes", function () {
    it("when data is the empty string without encoding", function () {
      app.post("/a", sendsJson({ foo: "bar" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.write("");
          req.write("", function () {
            req.end("");
          });
          req.on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }));
    });

    it("when data is the empty string with encoding", function () {
      app.post("/a", sendsJson({ foo: "bar" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.write("");
          req.write("", "utf8", function () {
            req.end("", "utf8");
          });
          req.on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }));
    });

    it("when data is Buffer.from('')", function () {
      app.post("/a", sendsJson({ foo: "bar" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.write(Buffer.from(""));
          req.write(Buffer.from(""), function () {
            req.end(Buffer.from(""));
          });
          req.on("error", reject);
        }))
        .then(asPromise(function (resolve, reject, res) {
          assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
          res.pipe(concat({ encoding: "string" }, resolve)).on("error", reject);
        }));
    });
  });

  describe("end accepts as arguments", function () {
    var called;
    function setCalled() {
      called = true;
    }

    beforeEach(function () {
      app.post("/a", function (req, res) {
        req.pipe(res);
      });
      called = false;
    });


    it("(none)", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end();
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "");
        });
    });

    it("the empty string", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end("");
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "");
        });
    });

    it("a non-empty string", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end("abc");
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "abc");
        });
    });

    it("a non-empty string and an encoding", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end("abc", "utf8");
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "abc");
        });
    });

    it("a non-empty string, an encoding, and a callback", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end("abc", "utf8", setCalled);
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "abc");
          assert.equal(called, true);
        });
    });

    it("a non-empty string and a callback", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end("abc", setCalled);
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "abc");
          assert.equal(called, true);
        });
    });

    it("a callback", function () {
      return server.start(app)
        .then(asPromise(function (resolve) {
          var req = http.request("http://localhost:3600/a", { method: "POST" }, resolve);
          req.end(setCalled);
        }))
        .then(asPromise(function (resolve, reject, res) {
          res.pipe(concat({ encoding: "string" }, resolve));
        }))
        .then(function (body) {
          assert.equal(body, "");
          assert.equal(called, true);
        });
    });
  });

  describe("change request options before redirects", function () {
    it("only call beforeRedirect on redirects, not the inital http call", function () {
      app.get("/a", sendsJson({ a: "b" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var options = {
            host: "localhost",
            port: 3600,
            path: "/a",
            method: "GET",
            beforeRedirect: function () {
              assert.fail("this should only be called on redirects");
            },
          };
          http.get(options, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { a: "b" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/a");
        });
    });

    it("ignore beforeRedirect if not a function", function () {
      app.get("/a", redirectsTo("/b"));
      app.get("/b", redirectsTo("/c"));
      app.get("/c", sendsJson({ a: "b" }));

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var options = {
            host: "localhost",
            port: 3600,
            path: "/a",
            method: "GET",
            beforeRedirect: 42,
          };
          http.get(options, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.deepEqual(res.parsedJson, { a: "b" });
          assert.deepEqual(res.responseUrl, "http://localhost:3600/c");
        });
    });

    it("append new header with every redirect", function () {
      app.get("/a", redirectsTo("/b"));
      app.get("/b", redirectsTo("/c"));
      app.get("/c", function (req, res) {
        res.json(req.headers);
      });
      var callsToTransform = 0;

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var options = {
            host: "localhost",
            port: 3600,
            path: "/a",
            method: "GET",
            beforeRedirect: function (optionz) {
              callsToTransform++;
              if (optionz.path === "/b") {
                optionz.headers["header-a"] = "value A";
              }
              else if (optionz.path === "/c") {
                optionz.headers["header-b"] = "value B";
              }
            },
          };
          http.get(options, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.strictEqual(callsToTransform, 2);
          assert.strictEqual(res.parsedJson["header-a"], "value A");
          assert.strictEqual(res.parsedJson["header-b"], "value B");
          assert.deepEqual(res.responseUrl, "http://localhost:3600/c");
        });
    });

    it("abort request chain after throwing an error", function () {
      var redirected = false;
      app.get("/a", redirectsTo("/b"));
      app.get("/b", function () {
        redirected = true;
        throw new Error("redirected request should have been aborted");
      });

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var options = {
            host: "localhost",
            port: 3600,
            path: "/a",
            method: "GET",
            beforeRedirect: function () {
              throw new Error("no redirects!");
            },
          };
          http.get(options, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function () {
          assert.fail("request chain should have been aborted");
        })
        .catch(function (error) {
          assert(!redirected);
          assert(error instanceof Error);
          assert.equal(error.message, "no redirects!");
        });
    });

    it("access response header in beforeRedirect", function () {
      app.get("/a", redirectsTo("/b"));
      app.get("/b", function (req, res) {
        res.json(req.headers);
      });

      return server.start(app)
        .then(asPromise(function (resolve, reject) {
          var options = {
            host: "localhost",
            port: 3600,
            path: "/a",
            method: "GET",
            beforeRedirect: function (optionz, response) {
              optionz.headers.testheader = "itsAtest" + response.headers.location;
            },
          };
          http.get(options, concatJson(resolve, reject)).on("error", reject);
        }))
        .then(function (res) {
          assert.strictEqual(res.parsedJson.testheader, "itsAtest/b");
          assert.deepEqual(res.responseUrl, "http://localhost:3600/b");
        });
    });
  });
});

function noop() { /* noop */ }
