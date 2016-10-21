'use strict';
var url = require('url');
var assert = require('assert');
var http = require('http');
var https = require('https');
var Writable = require('stream').Writable;
var debug = require('debug')('follow-redirects');

var nativeProtocols = {'http:': http, 'https:': https};
var exports = module.exports = {
	maxRedirects: 21
};

// Wrapper around the native request
function RequestProxy(callback) {
	Writable.call(this);
	if (callback) {
		this.on('response', callback);
	}
}
RequestProxy.prototype = Object.create(Writable.prototype);

RequestProxy.prototype.abort = function () {
	this._request.abort();
};

RequestProxy.prototype.end = function (data, encoding, callback) {
	this._request.end(data, encoding, callback);
};

RequestProxy.prototype.flushHeaders = function () {
	this._request.flushHeaders();
};

RequestProxy.prototype.setNoDelay = function (noDelay) {
	this._request.setNoDelay(noDelay);
};

RequestProxy.prototype.setSocketKeepAlive = function (enable, initialDelay) {
	this._request.setSocketKeepAlive(enable, initialDelay);
};

RequestProxy.prototype.setTimeout = function (timeout, callback) {
	this._request.setSocketKeepAlive(timeout, callback);
};

RequestProxy.prototype._write = function (chunk, encoding, callback) {
	this._request.write(chunk, encoding, callback);
};

function execute(options, callback) {
	var fetchedUrls = [];
	var requestProxy = new RequestProxy(callback);
	nextRequest(null);
	return requestProxy;

	function nextRequest(previousResponse) {
		// skip the redirection logic on the first call.
		if (previousResponse) {
			var fetchedUrl = url.format(options);
			fetchedUrls.unshift(fetchedUrl);

			if (!isRedirect(previousResponse)) {
				previousResponse.fetchedUrls = fetchedUrls;
				requestProxy.emit('response', previousResponse);
				return;
			}

			// need to use url.resolve() in case location is a relative URL
			var redirectUrl = url.resolve(fetchedUrl, previousResponse.headers.location);
			debug('redirecting to', redirectUrl);
			extend(options, url.parse(redirectUrl));
		}

		if (fetchedUrls.length > options.maxRedirects) {
			var err = new Error('Max redirects exceeded.');
			requestProxy.emit('error', err);
			return;
		}

		options.nativeProtocol = nativeProtocols[options.protocol];
		options.defaultRequest = defaultMakeRequest;

		var makeRequest = options.makeRequest || defaultMakeRequest;
		var request = makeRequest(options, previousResponse, nextRequest);
		requestProxy._request = request;
		mirrorEvent(request, 'abort');
		mirrorEvent(request, 'aborted');
		mirrorEvent(request, 'error');
		return request;
	}

	function defaultMakeRequest(options, response, callback) {
		if (response && response.statusCode !== 307) {
			// This is a redirect, so use only GET methods, except for status 307,
			// which must honor the previous request method.
			options.method = 'GET';
		}

		var request = options.nativeProtocol.request(options, callback);

		if (response) {
			// We leave the user to call `end` on the first request
			request.end();
		}

		return request;
	}

	// send events through the proxy
	function mirrorEvent(request, event) {
		request.on(event, function (arg) {
			requestProxy.emit(event, arg);
		});
	}
}

// returns a safe copy of options (or a parsed url object if options was a string).
// validates that the supplied callback is a function
function parseOptions(options, wrappedProtocol) {
	if (typeof options === 'string') {
		options = url.parse(options);
		options.maxRedirects = exports.maxRedirects;
	} else {
		options = extend({
			maxRedirects: exports.maxRedirects,
			protocol: wrappedProtocol
		}, options);
	}
	assert.equal(options.protocol, wrappedProtocol, 'protocol mismatch');

	debug('options', options);
	return options;
}

// copies source's own properties onto destination and returns destination
function extend(destination, source) {
	var keys = Object.keys(source);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		destination[key] = source[key];
	}
	return destination;
}

// to redirect the result must have
// a statusCode between 300-399
// and a `Location` header
function isRedirect(response) {
	return (response.statusCode >= 300 && response.statusCode <= 399 &&
	'location' in response.headers);
}

Object.keys(nativeProtocols).forEach(function (wrappedProtocol) {
	var scheme = wrappedProtocol.substr(0, wrappedProtocol.length - 1);
	var nativeProtocol = nativeProtocols[wrappedProtocol];
	var protocol = exports[scheme] = Object.create(nativeProtocol);

	protocol.request = function (options, callback) {
		return execute(parseOptions(options, wrappedProtocol), callback);
	};

	// see https://github.com/joyent/node/blob/master/lib/http.js#L1623
	protocol.get = function (options, callback) {
		var request = execute(parseOptions(options, wrappedProtocol), callback);
		request.end();
		return request;
	};
});
