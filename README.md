## Follow Redirects

Drop-in replacement for Node's `http` and `https` modules that automatically follows redirects.

[![npm version](https://img.shields.io/npm/v/follow-redirects.svg)](https://www.npmjs.com/package/follow-redirects)
[![Build Status](https://travis-ci.org/follow-redirects/follow-redirects.svg?branch=master)](https://travis-ci.org/follow-redirects/follow-redirects)
[![Coverage Status](https://coveralls.io/repos/follow-redirects/follow-redirects/badge.svg?branch=master)](https://coveralls.io/r/follow-redirects/follow-redirects?branch=master)
[![npm downloads](https://img.shields.io/npm/dm/follow-redirects.svg)](https://www.npmjs.com/package/follow-redirects)

`follow-redirects` provides [request](https://nodejs.org/api/http.html#http_http_request_options_callback) and [get](https://nodejs.org/api/http.html#http_http_get_options_callback)
 methods that behave identically to those found on the native [http](https://nodejs.org/api/http.html#http_http_request_options_callback) and [https](https://nodejs.org/api/https.html#https_https_request_options_callback)
 modules, with the exception that they will seamlessly follow redirects.

```javascript
var http = require('follow-redirects').http;
var https = require('follow-redirects').https;

http.get('http://bit.ly/900913', function (response) {
  response.on('data', function (chunk) {
    console.log(chunk);
  });
}).on('error', function (err) {
  console.error(err);
});
```

You can inspect the final redirected URL through the `responseUrl` property on the `response`.
If no redirection happened, `responseUrl` is the original request URL.

```javascript
https.request({
  host: 'bitly.com',
  path: '/UHfDGO',
}, function (response) {
  console.log(response.responseUrl);
  // 'http://duckduckgo.com/robots.txt'
});
```

## Options
### Global options
Global options are set directly on the `follow-redirects` module:

```javascript
var followRedirects = require('follow-redirects');
followRedirects.maxRedirects = 10;
followRedirects.maxBodyLength = 20 * 1024 * 1024; // 20 MB
followRedirects.beforeRedirect = function (options) {
  // Use this function to adjust the options upon redirecting,
  // or to cancel the request by throwing an error
  if (options.hostname === "example.com") {
    options.auth = "user:password";
  }
};
```

The following global options are supported:

- `maxRedirects` (default: `21`) – sets the maximum number of allowed redirects; if exceeded, an error will be emitted.

- `maxBodyLength` (default: 10MB) – sets the maximum size of the request body; if exceeded, an error will be emitted.
- 
- `beforeRedirect` (default: `undefined`) – optionally change request `options` or cancel the request; this function is called on every redirect.


### Per-request options
Per-request options are set by passing an `options` object:

```javascript
var url = require('url');
var followRedirects = require('follow-redirects');

var options = url.parse('http://bit.ly/900913');
options.maxRedirects = 10;
http.request(options);
```

In addition to the [standard HTTP](https://nodejs.org/api/http.html#http_http_request_options_callback) and [HTTPS options](https://nodejs.org/api/https.html#https_https_request_options_callback),
the following per-request options are supported:
- `followRedirects` (default: `true`) – whether redirects should be followed.

- `maxRedirects` (default: `21`) – sets the maximum number of allowed redirects; if exceeded, an error will be emitted.

- `maxBodyLength` (default: 10MB) – sets the maximum size of the request body; if exceeded, an error will be emitted.

- `beforeRedirect` (default: `undefined`) – optionally change request `options` or cancel the request; this function is called on every redirect.

- `agents` (default: `undefined`) – sets the `agent` option per protocol, since HTTP and HTTPS use different agents. Example value: `{ http: new http.Agent(), https: new https.Agent() }`

- `trackRedirects` (default: `false`) – whether to store the redirected response details into the `redirects` array on the response object.


### Advanced usage
By default, `follow-redirects` will use the Node.js default implementations
of [`http`](https://nodejs.org/api/http.html)
and [`https`](https://nodejs.org/api/https.html).
To enable features such as caching and/or intermediate request tracking,
you might instead want to wrap `follow-redirects` around custom protocol implementations:

```javascript
var followRedirects = require('follow-redirects').wrap({
  http: require('your-custom-http'),
  https: require('your-custom-https'),
});
```

Such custom protocols only need an implementation of the `request` method.

## Browser Usage

Due to the way the browser works,
the `http` and `https` browser equivalents perform redirects by default.

By requiring `follow-redirects` this way:
```javascript
var http = require('follow-redirects/http');
var https = require('follow-redirects/https');
```
you can easily tell webpack and friends to replace
`follow-redirect` by the built-in versions:

```json
{
  "follow-redirects/http"  : "http",
  "follow-redirects/https" : "https"
}
```

## Contributing

Pull Requests are always welcome. Please [file an issue](https://github.com/follow-redirects/follow-redirects/issues)
 detailing your proposal before you invest your valuable time. Additional features and bug fixes should be accompanied
 by tests. You can run the test suite locally with a simple `npm test` command.

## Debug Logging

`follow-redirects` uses the excellent [debug](https://www.npmjs.com/package/debug) for logging. To turn on logging
 set the environment variable `DEBUG=follow-redirects` for debug output from just this module. When running the test
 suite it is sometimes advantageous to set `DEBUG=*` to see output from the express server as well.

## Authors

- Olivier Lalonde (olalonde@gmail.com)
- James Talmage (james@talmage.io)
- [Ruben Verborgh](https://ruben.verborgh.org/)

## License

[MIT License](https://github.com/follow-redirects/follow-redirects/blob/master/LICENSE)
