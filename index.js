'use strict';
var url = require('url');
var assert = require('assert');
var http = require('http');
var https = require('https');
var Writable = require('stream').Writable;
var debug = require('debug')('follow-redirects');

var nativeProtocols = {'http:': http, 'https:': https};
var mirroredEvents = ['abort', 'aborted', 'error'];
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

	// Create handlers to mirror events from native requests
	var eventMirrors = this._eventMirrors = Object.create(null);
	mirroredEvents.forEach(function (event) {
		eventMirrors[event] = function (arg) {
			self.emit(event, arg);
		};
	});

	// Perform the first request
	this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);

// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
	if (this._currentResponse && this._currentResponse.statusCode !== 307) {
		// This is a redirect, so use only GET methods, except for status 307,
		// which must honor the previous request method.
		this._options.method = 'GET';
	}

	// Create the native request through the native protocol
	var protocol = nativeProtocols[this._options.protocol];
	var request = this._currentRequest =
								protocol.request(this._options, this._onNativeResponse);
	this._currentUrl = url.format(this._options);

	// Mirror events from the native request
	for (var event in this._eventMirrors) {
		if (event) {
			request.on(event, this._eventMirrors[event]);
		}
	}

	// The first request is explicitly ended in RedirectableRequest#end
	if (this._currentResponse) {
		request.end();
	}
};

// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
	// Emit the response if it is not a redirect
	if (response.statusCode < 300 || response.statusCode > 399 ||
			!response.headers.location) {
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
	Object.assign(this._options, url.parse(redirectUrl));
	this._currentResponse = response;
	this._performRequest();
};

// Aborts the current native request
RedirectableRequest.prototype.abort = function () {
	this._currentRequest.abort();
};

// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
	this._currentRequest.end(data, encoding, callback);
};

// Flushes the headers of the current native request
RedirectableRequest.prototype.flushHeaders = function () {
	this._currentRequest.flushHeaders();
};

// Sets the noDelay option of the current native request
RedirectableRequest.prototype.setNoDelay = function (noDelay) {
	this._currentRequest.setNoDelay(noDelay);
};

// Sets the socketKeepAlive option of the current native request
RedirectableRequest.prototype.setSocketKeepAlive = function (enable, initialDelay) {
	this._currentRequest.setSocketKeepAlive(enable, initialDelay);
};

// Sets the timeout option of the current native request
RedirectableRequest.prototype.setTimeout = function (timeout, callback) {
	this._currentRequest.setSocketKeepAlive(timeout, callback);
};

// Writes buffered data to the current native request
RedirectableRequest.prototype._write = function (chunk, encoding, callback) {
	this._currentRequest.write(chunk, encoding, callback);
};

// Export a redirecting wrapper for each native protocol
Object.keys(nativeProtocols).forEach(function (protocol) {
	var scheme = protocol.substr(0, protocol.length - 1);
	var nativeProtocol = nativeProtocols[protocol];
	var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

	// Executes an HTTP request, following redirects
	wrappedProtocol.request = function (options, callback) {
		if (typeof options === 'string') {
			options = url.parse(options);
			options.maxRedirects = exports.maxRedirects;
		} else {
			options = Object.assign({
				maxRedirects: exports.maxRedirects,
				protocol: protocol
			}, options);
		}
		assert.equal(options.protocol, protocol, 'protocol mismatch');
		debug('options', options);

		return new RedirectableRequest(options, callback);
	};

	// Executes a GET request, following redirects
	wrappedProtocol.get = function (options, callback) {
		var request = wrappedProtocol.request(options, callback);
		request.end();
		return request;
	};
});
