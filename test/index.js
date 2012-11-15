var https = require('../').https,
  http = require('../').http,
  nativeHttps = require('https'),
  nativeHttp = require('http');

var urls = [
  'http://bit.ly/900913',
  {
    type: 'https',
    host: 'bitly.com',
    path: '/UHfDGO'
  }
];

http.maxRedirects = 5;


var libs = {
  http: {
    native: nativeHttp,
    follow: http
  },
  https: {
    native: nativeHttps,
    follow: https
  }
};

urls.forEach(function (url) {

  var proto = 'http';
  if (typeof url === 'string' && url.substr(0, 5) === 'https') {
      proto = 'https';
  }
  else if (url.type === 'https') {
      proto = 'https';
  }
  for (var key in libs[proto]) {
    var lib = libs[proto][key];
    lib.get(url, function(res) {
      console.log("statusCode: ", res.statusCode);
      console.log("headers: ", res.headers);

      res.on('data', function(d) {
        process.stdout.write(d);
      });

    }).on('error', function(e) {
      console.error(e);
    });
  };
});
