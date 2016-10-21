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

// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
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
RedirectableRequest.prototype = Object.create(Writable.prototype);

RedirectableRequest.prototype._performRequest = function () {
	if (this._currentResponse && this._currentResponse.statusCode !== 307) {
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

	// The first request is explicitly ended in RedirectableRequest#end
	if (this._currentResponse) {
		request.end();
	}
};

RedirectableRequest.prototype._processResponse = function (response) {
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
	this._currentResponse = response;
	this._performRequest();
};

RedirectableRequest.prototype.abort = function () {
	this._currentRequest.abort();
};

RedirectableRequest.prototype.end = function (data, encoding, callback) {
	this._currentRequest.end(data, encoding, callback);
};

RedirectableRequest.prototype.flushHeaders = function () {
	this._currentRequest.flushHeaders();
};

RedirectableRequest.prototype.setNoDelay = function (noDelay) {
	this._currentRequest.setNoDelay(noDelay);
};

RedirectableRequest.prototype.setSocketKeepAlive = function (enable, initialDelay) {
	this._currentRequest.setSocketKeepAlive(enable, initialDelay);
};

RedirectableRequest.prototype.setTimeout = function (timeout, callback) {
	this._currentRequest.setSocketKeepAlive(timeout, callback);
};

RedirectableRequest.prototype._write = function (chunk, encoding, callback) {
	this._currentRequest.write(chunk, encoding, callback);
};

// send events through the proxy
function mirrorEvent(source, destination, event) {
	source.on(event, function (arg) {
		destination.emit(event, arg);
	});
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

// Export a wrapper for each native protocol
Object.keys(nativeProtocols).forEach(function (protocol) {
	var scheme = protocol.substr(0, protocol.length - 1);
	var nativeProtocol = nativeProtocols[protocol];
	var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

	wrappedProtocol.request = function (options, callback) {
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

		return new RedirectableRequest(options, callback);
	};

	// see https://github.com/joyent/node/blob/master/lib/http.js#L1623
	wrappedProtocol.get = function (options, callback) {
		var request = wrappedProtocol.request(options, callback);
		request.end();
		return request;
	};
});
