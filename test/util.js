var concat = require("concat-stream");
var http = require("http");
var https = require("https");
var url = require("url");

function redirectsTo() {
  var args = Array.prototype.slice.call(arguments);
  return function (req, res) {
    res.redirect.apply(res, args);
  };
}

function sendsJson(json) {
  return function (req, res) {
    res.json(json);
  };
}

function concatJson(resolve, reject) {
  return function (res) {
    res.pipe(concat({ encoding: "string" }, function (string) {
      try {
        res.parsedJson = JSON.parse(string);
        resolve(res);
      }
      catch (err) {
        reject(new Error("error parsing " + JSON.stringify(string) + "\n caused by: " + err.message));
      }
    })).on("error", reject);
  };
}

function delay(clock, msecs, handler) {
  return function (req, res) {
    clock.tick(msecs);
    handler(req, res);
  };
}

function asPromise(cb) {
  return function (result) {
    return new Promise(function (resolve, reject) {
      cb(resolve, reject, result);
    });
  };
}

function proxy(proxyHost) {
  return function (req, res) {
    var upstreamUrl = new url.URL(req.originalUrl);
    if (upstreamUrl.host === proxyHost) {
      res.writeHead(400, "Bad request");
      res.write(JSON.stringify({ bad: "detected proxy recursion" }));
      res.end();
    }
    else {
      var transport = /https:?/.test(upstreamUrl.protocol) ? https : http;
      upstreamUrl.headers = req.headers;
      var upstreamReq = transport.request(upstreamUrl, function (upstreamRes) {
        res.writeHead(upstreamRes.statusCode, upstreamRes.statusMessage, upstreamRes.headers);
        upstreamRes.pipe(res);
      });
      upstreamReq.end();
    }
  };
}

// TODO: copied from index.js - how dedupe?
// URL fields to preserve in copy operations
var preservedUrlFields = [
  "auth",
  "host",
  "hostname",
  "href",
  "path",
  "pathname",
  "port",
  "protocol",
  "query",
  "search",
  "hash",
];

function spreadUrlObject(urlObject, target) {
  var spread = target || {};
  for (var key of preservedUrlFields) {
    spread[key] = urlObject[key];
  }

  // Fix IPv6 hostname
  if (spread.hostname.startsWith("[")) {
    spread.hostname = spread.hostname.slice(1, -1);
  }
  // Ensure port is a number
  if (spread.port !== "") {
    spread.port = Number(spread.port);
  }
  // Concatenate path
  spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;

  return spread;
}

module.exports = {
  asPromise: asPromise,
  concatJson: concatJson,
  delay: delay,
  proxy: proxy,
  redirectsTo: redirectsTo,
  sendsJson: sendsJson,
  spreadUrlObject: spreadUrlObject,
};
