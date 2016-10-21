var path = require('path');
var fs = require('fs');

function addServerOptions(options) {
	options = options || {};
	options.cert = fs.readFileSync(path.join(__dirname, 'TestServer.crt'));
	options.key = fs.readFileSync(path.join(__dirname, 'TestServer.pem'));
	return options;
}

function addClientOptions(options) {
	options = options || {};
	options.ca = [fs.readFileSync(path.join(__dirname, 'TestCA.crt'))];
	options.agent = false;
	return options;
}

function deleteOptions(options) {
	delete options.ca;
	delete options.agent;
	delete options.cert;
	delete options.key;
}

function makeRequest(options, res, callback) {
	if (options.protocol === 'https:') {
		addClientOptions(options);
	} else {
		deleteOptions(options);
	}
	return options.defaultRequest(options, res, callback);
}

module.exports = {
	addServerOptions: addServerOptions,
	addClientOptions: addClientOptions,
	deleteOptions: deleteOptions,
	makeRequest: makeRequest
};
