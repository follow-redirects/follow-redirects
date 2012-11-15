var nativeHttps = require('https'),
  nativeHttp = require('http'),
  url = require('url'),
  _ = require('underscore');

var maxRedirects = module.exports.maxRedirects = 5;

var protocols = {
  https: nativeHttps,
  http: nativeHttp
};

// Only use GETs on redirects
for (var protocol in protocols) {
  // h is either our cloned http or https object
  var h =  function() {};
  h.prototype = protocols[protocol];
  h = new h();

  module.exports[protocol] = h;

  h.get = function (options, callback, redirectOptions) {
    var self = this,
      userCallback = callback,
      reqUrl;

    var redirect = _.extend({
      count: 0,
      max: options.maxRedirects || maxRedirects,
      clientRequest: null
    }, redirectOptions);

    /**
     * Emit error if too many redirects
     */
    if (redirect.count > redirect.max) {
      var err = new Error('Max redirects exceeded. To allow more redirects, set maxRedirects property.');
      redirect.clientRequest.emit('error', err);
      return;
    }

    redirect.count++;

    /**
     * Parse URL from options
     */
    if (typeof options === 'string') {
      reqUrl = options;
    }
    else {
      var urlFormat = _.extend({}, options);
      urlFormat.protocol = protocol;
      reqUrl = url.format(urlFormat);
      console.log(reqUrl);
    }

    /*
     * Build client request
     */
    var clientRequest = this.__proto__.get(options, redirectCallback);

    // save clientRequest to our redirectOptions so we can emit errors later
    if (!redirect.clientRequest) redirect.clientRequest = clientRequest;

    /**
     * ClientRequest callback for redirects
     */
    function redirectCallback(res) {
      // status must be 300-399 for redirects
      if (res.statusCode < 300 || res.statusCode > 399) {
        return userCallback(res);
      }
      // no `Location:` header => nowhere to redirect
      if (!('location' in res.headers)) {
        return userCallback(res);
      }
      // need to use url.resolve() in case location is a relative URL
      var redirectUrl = url.resolve(reqUrl, res.headers['location']);
      // we need to call the right api (http vs https) depending on protocol
      var proto = url.parse(redirectUrl).protocol;
      proto = proto.substr(0, proto.length - 1);
      return module.exports[proto].get(redirectUrl, redirectCallback, redirect);
    }

    return clientRequest;
  };

  //h.request = function () {
    //console.log('oops');
  //}

}

//function resolve (opts, url) {

  //var redirectCount = 0, maxRedirects = 5;
  //function get(fileUrl) {
    //https.get(fileUrl, function(res) {
      //console.log(fileUrl);
      //if (res.statusCode >= 400) {
        //return fn(new Error('URL ' + url + ' returns statusCode ' + res.statusCode + '.'));
      //}
      //// Follow redirects
      //if (res.headers['location']) {
        //if (redirectCount == maxRedirects) 
          //return fn(new Error('Maximum redirects reached.'));

        //var redirectUrl = url.resolve(fileUrl, res.headers['location']);
        //redirectCount++;
        //return get(redirectUrl);
      //}
      //var contentType = res.headers['content-type'],
        //contentLength = res.headers['content-length'];

      //headers = utils.merge({
        //'Content-Length': contentLength,
        //'Content-Type': contentType
      //}, headers);

      //var req = self.putStream(res, filename, headers, fn);
      //req.on('progress', emitter.emit.bind(emitter, 'progress'));

    //}).on('error', function(err) {
      //fn(err);
    //});
  //}
  //get(fileUrl);


//}

