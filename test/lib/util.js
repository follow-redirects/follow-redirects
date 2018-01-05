var concat = require("concat-stream");
var BPromise = require("bluebird");

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

function asPromise(cb) {
  return function (result) {
    return new BPromise(function (resolve, reject) {
      cb(resolve, reject, result);
    });
  };
}

module.exports = {
  asPromise: asPromise,
  concatJson: concatJson,
  redirectsTo: redirectsTo,
  sendsJson: sendsJson,
};
