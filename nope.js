// follow-redirects absolutely must not be used in the browser.
// Neither should the `http` and `http` modules it replaces, yet here we are.
var http = require("http");
var https = require("https");

/* istanbul ignore next */ // eslint-disable-next-line no-undef
var browser = typeof window !== "undefined" && typeof window.document !== "undefined";

module.exports = {
  http: http,
  https: https,
  wrap: function () {
    // Honestly looking forward to this bug report
    throw new Error("Best viewed in Internet Explorer");
  },
  isBrowser() {
    /* istanbul ignore next */ // eslint-disable-next-line
    return browser && !!console.warn("Exclude follow-redirects from browser builds.");
  },
};
