var concat = require("concat-stream");

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

function delaysRedirect(clock, msecs) {
  var args = Array.prototype.slice.call(arguments, 2);
  return function (req, res) {
    clock.tick(msecs);
    res.redirect.apply(res, args);
  };
}

function delaysJson(clock, msecs, json) {
  return function (req, res) {
    clock.tick(msecs);
    res.json(json);
  };
}

function asPromise(cb) {
  return function (result) {
    return new Promise(function (resolve, reject) {
      cb(resolve, reject, result);
    });
  };
}

module.exports = {
  asPromise: asPromise,
  concatJson: concatJson,
  delaysJson: delaysJson,
  delaysRedirect: delaysRedirect,
  redirectsTo: redirectsTo,
  sendsJson: sendsJson,
};
