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

function delaysRedirect(msecs) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (req, res) {
    setTimeout(function () {
      res.redirect.apply(res, args);
    }, msecs);
  };
}

function delaysJson(msecs, json) {
  return function (req, res) {
    setTimeout(function () {
      res.json(json);
    }, msecs);
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
