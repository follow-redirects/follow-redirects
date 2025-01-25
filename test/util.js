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

function concatString(resolve, reject) {
  return function (res) {
    res.pipe(concat({ encoding: "string" }, function (string) {
        res.body = string;
        resolve(res);
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
    var upstreamUrl = url.parse(req.originalUrl);
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

module.exports = {
  asPromise: asPromise,
  concatJson: concatJson,
  concatString: concatString,
  delay: delay,
  proxy: proxy,
  redirectsTo: redirectsTo,
  sendsJson: sendsJson,
};
