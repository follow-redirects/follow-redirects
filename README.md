## Follow Redirects

Drop in replacement for Nodes `http` and `https` modules that will automatically follow HTTP redirects.

[![Build Status](https://travis-ci.org/olalonde/follow-redirects.svg?branch=master)](https://travis-ci.org/olalonde/follow-redirects)
[![Coverage Status](https://coveralls.io/repos/olalonde/follow-redirects/badge.svg?branch=master)](https://coveralls.io/r/olalonde/follow-redirects?branch=master)
[![Code Climate](https://codeclimate.com/github/olalonde/follow-redirects/badges/gpa.svg)](https://codeclimate.com/github/olalonde/follow-redirects)
[![Dependency Status](https://david-dm.org/olalonde/follow-redirects.svg)](https://david-dm.org/olalonde/follow-redirects)
[![devDependency Status](https://david-dm.org/olalonde/follow-redirects/dev-status.svg)](https://david-dm.org/olalonde/follow-redirects#info=devDependencies)

[![NPM](https://nodei.co/npm/follow-redirects.png?downloads=true)](https://nodei.co/npm/follow-redirects/)

`follow-redirects` provides [request](https://nodejs.org/api/http.html#http_http_request_options_callback) and [get](https://nodejs.org/api/http.html#http_http_get_options_callback) 
 methods that behave identically to those found on the native [http](https://nodejs.org/api/http.html#http_http_request_options_callback) and [https](https://nodejs.org/api/https.html#https_https_request_options_callback)
 modules, with the exception that they will seamlessly follow redirects.

```javascript
var http = require('follow-redirects').http;
var https = require('follow-redirects').https;

http.get('http://bit.ly/900913', function (res) {
  res.on('data', function (chunk) {
    console.log(chunk);
  });
}).on('error', function (err) {
  console.error(err);
});
```

By default the number of redirects is limited to 5, but you can modify that globally or per request.

```javascript
require('follow-redirects).maxRedirects = 10;   // Has global affect (be careful!)

https.request({
  host: 'bitly.com',
  path: '/UHfDGO',
  maxRedirects: 3   // per request setting
}, function (res) {/* ... */});
```

## Contributing

Pull Requests are always welcome. Please [file an issue](https://github.com/olalonde/follow-redirects/issues)
 detailing your proposal before you invest your valuable time. Additional features and bug fixes should be accompanied
 by tests. You can run the test suite locally with a simple `npm test` command.
 
## Debug Logging

`follow-redirects` uses the excellent [debug](https://www.npmjs.com/package/debug) for logging. To turn on logging
 set the environment variable `DEBUG=follow-redirects` for debug output from just this module. When running the test
 suite it is sometimes advantageous to set `DEBUG=*` to see output from the express server as well.

## Authors

Olivier Lalonde (olalonde@gmail.com)
James Talmage (james@talmage.io)

## License

MIT: [http://olalonde.mit-license.org](http://olalonde.mit-license.org)
