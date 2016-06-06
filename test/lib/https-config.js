var path = require('path');
var fs = require('fs');
var node8 = require('semver').lt(process.version, '0.9.0');

function addServerOptions(options) {
	options = options || {};
	// options.ca = [fs.readFileSync(__dirname + '/TestCA.crt')];
	options.cert = fs.readFileSync(path.join(__dirname, 'TestServer.crt'));
	options.key = fs.readFileSync(path.join(__dirname, 'TestServer.pem'));
	return options;
}

function addClientOptions(options) {
	options = options || {};
	options.ca = [fs.readFileSync(path.join(__dirname, 'TestCA.crt'))];
	// options.cert = fs.readFileSync(__dirname + '/TestClient.crt');
	// options.key = fs.readFileSync(__dirname + '/TestClient.pem') ;

	if (node8) {
		options.agent = new options.nativeProtocol.Agent(options);
	} else {
		options.agent = false;
	}
	return options;
}

function deleteOptions(options) {
	delete options.ca;
	delete options.agent;
	delete options.cert;
	delete options.key;
}

function makeRequest(options, cb, res) {
	if (options.protocol === 'https:') {
		addClientOptions(options);
	} else {
		deleteOptions(options);
	}
	return options.defaultRequest(options, cb, res);
}

module.exports = {
	addServerOptions: addServerOptions,
	addClientOptions: addClientOptions,
	deleteOptions: deleteOptions,
	makeRequest: makeRequest
};
