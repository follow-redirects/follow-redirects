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
function RequestProxy(options, responseCallback) {
	// Initialize the request
	Writable.call(this);
	this._options = options;
	this._redirectCount = 0;

	// Attach a callback if passed
	if (responseCallback) {
		this.on('response', responseCallback);
	}

	// React to responses of native requests
	var self = this;
	this._onNativeResponse = function (response) {
		self._processResponse(response);
	};

	// Perform the first request
	this._performRequest();
}
RequestProxy.prototype = Object.create(Writable.prototype);

RequestProxy.prototype._performRequest = function () {
	if (this._previousResponse && this._previousResponse.statusCode !== 307) {
		// This is a redirect, so use only GET methods, except for status 307,
		// which must honor the previous request method.
		this._options.method = 'GET';
	}

	// Perform the request through the native protocol
	var protocol = nativeProtocols[this._options.protocol];
	var request = this._currentRequest =
								protocol.request(this._options, this._onNativeResponse);
	this._currentUrl = url.format(this._options);
	mirrorEvent(request, this, 'abort');
	mirrorEvent(request, this, 'aborted');
	mirrorEvent(request, this, 'error');

	// The first request is explicitly ended in RequestProxy#end
	if (this._previousResponse) {
		request.end();
	}
};

RequestProxy.prototype._processResponse = function (response) {
	// Emit the response if it is not a redirect
	if (!isRedirect(response)) {
		response.redirectUrl = this._currentUrl;
		return this.emit('response', response);
	}

	// Only allow a limited number of redirects
	if (++this._redirectCount > this._options.maxRedirects) {
		return this.emit('error', new Error('Max redirects exceeded.'));
	}

	// Create and execute a redirect request
	var location = response.headers.location;
	var redirectUrl = url.resolve(this._currentUrl, location);
	debug('redirecting to', redirectUrl);
	extend(this._options, url.parse(redirectUrl));
	this._previousResponse = response;
	this._performRequest();
};

RequestProxy.prototype.abort = function () {
	this._currentRequest.abort();
};

RequestProxy.prototype.end = function (data, encoding, callback) {
	this._currentRequest.end(data, encoding, callback);
};

RequestProxy.prototype.flushHeaders = function () {
	this._currentRequest.flushHeaders();
};

RequestProxy.prototype.setNoDelay = function (noDelay) {
	this._currentRequest.setNoDelay(noDelay);
};

RequestProxy.prototype.setSocketKeepAlive = function (enable, initialDelay) {
	this._currentRequest.setSocketKeepAlive(enable, initialDelay);
};

RequestProxy.prototype.setTimeout = function (timeout, callback) {
	this._currentRequest.setSocketKeepAlive(timeout, callback);
};

RequestProxy.prototype._write = function (chunk, encoding, callback) {
	this._currentRequest.write(chunk, encoding, callback);
};

// send events through the proxy
function mirrorEvent(source, destination, event) {
	source.on(event, function (arg) {
		destination.emit(event, arg);
	});
}

// returns a safe copy of options (or a parsed url object if options was a string).
// validates that the supplied callback is a function
function parseOptions(options, protocol) {
	if (typeof options === 'string') {
		options = url.parse(options);
		options.maxRedirects = exports.maxRedirects;
	} else {
		options = extend({
			maxRedirects: exports.maxRedirects,
			protocol: protocol
		}, options);
	}
	assert.equal(options.protocol, protocol, 'protocol mismatch');

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

Object.keys(nativeProtocols).forEach(function (protocol) {
	var scheme = protocol.substr(0, protocol.length - 1);
	var nativeProtocol = nativeProtocols[protocol];
	var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

	wrappedProtocol.request = function (options, callback) {
		return new RequestProxy(parseOptions(options, protocol), callback);
	};

	// see https://github.com/joyent/node/blob/master/lib/http.js#L1623
	wrappedProtocol.get = function (options, callback) {
		var request = wrappedProtocol.request(options, callback);
		request.end();
		return request;
	};
});
