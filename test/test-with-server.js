describe('follow-redirects ', function () {
	var express = require('express');
	var assert = require('assert');
	var server = require('./lib/test-server')({
		https: 3601,
		http: 3600
	});
	var url = require('url');
	var followRedirects = require('..');
	var http = followRedirects.http;
	var https = followRedirects.https;
	var BPromise = require('bluebird');

	var util = require('./lib/util');
	var concatJson = util.concatJson;
	var redirectsTo = util.redirectsTo;
	var sendsJson = util.sendsJson;
	var asPromise = util.asPromise;

	var fs = require('fs');
	var path = require('path');

	function httpsOptions(app) {
		return {
			app: app,
			protocol: 'https',
			cert: fs.readFileSync(path.join(__dirname, 'lib/TestServer.crt')),
			key: fs.readFileSync(path.join(__dirname, 'lib/TestServer.pem'))
		};
	}
	var ca = fs.readFileSync(path.join(__dirname, 'lib/TestCA.crt'));

	var app;
	var app2;
	var originalMaxRedirects;

	beforeEach(function () {
		originalMaxRedirects = followRedirects.maxRedirects;
		app = express();
		app2 = express();
	});

	afterEach(function (done) {
		followRedirects.maxRedirects = originalMaxRedirects;
		server.stop().nodeify(done);
	});

	it('http.get with callback', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', redirectsTo('/c'));
		app.get('/c', redirectsTo('/d'));
		app.get('/d', redirectsTo('/e'));
		app.get('/e', redirectsTo('/f'));
		app.get('/f', sendsJson({a: 'b'}));

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				http.get('http://localhost:3600/a', concatJson(resolve, reject)).on('error', reject);
			}))
			.then(function (res) {
				assert.deepEqual(res.parsedJson, {a: 'b'});
				assert.deepEqual(res.responseUrl, 'http://localhost:3600/f');
			})
			.nodeify(done);
	});

	it('http.get with response event', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', redirectsTo('/c'));
		app.get('/c', redirectsTo('/d'));
		app.get('/d', redirectsTo('/e'));
		app.get('/e', redirectsTo('/f'));
		app.get('/f', sendsJson({a: 'b'}));

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				http.get('http://localhost:3600/a')
						.on('response', concatJson(resolve, reject))
						.on('error', reject);
			}))
			.then(function (res) {
				assert.deepEqual(res.parsedJson, {a: 'b'});
				assert.deepEqual(res.responseUrl, 'http://localhost:3600/f');
			})
			.nodeify(done);
	});

	it('should return with the original status code if the response does not contain a location header', function (done) {
		app.get('/a', function (req, res) {
			res.status(307).end();
		});

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				http.get('http://localhost:3600/a', resolve).on('error', reject);
			}))
			.then(function (res) {
				assert.equal(res.statusCode, 307);
				assert.deepEqual(res.responseUrl, 'http://localhost:3600/a');
				res.on('data', function () {
					// noop to consume the stream (server won't shut down otherwise).
				});
			})
			.nodeify(done);
	});

	it('should emit connection errors on the returned stream', function (done) {
		app.get('/a', redirectsTo('http://localhost:36002/b'));

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				http.get('http://localhost:3600/a', reject).on('error', resolve);
			}))
			.then(function (error) {
				assert.equal(error.code, 'ECONNREFUSED');
			})
			.nodeify(done);
	});

	it('should follow redirects over https', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', redirectsTo('/c'));
		app.get('/c', sendsJson({baz: 'quz'}));

		server.start(httpsOptions(app))
			.then(asPromise(function (resolve, reject) {
				var opts = url.parse('https://localhost:3601/a');
				opts.ca = ca;
				https.get(opts, concatJson(resolve, reject)).on('error', reject);
			}))
			.then(function (res) {
				assert.deepEqual(res.parsedJson, {baz: 'quz'});
				assert.deepEqual(res.responseUrl, 'https://localhost:3601/c');
			})
			.nodeify(done);
	});

	it('should honor query params in redirects', function (done) {
		app.get('/a', redirectsTo('/b?greeting=hello'));
		app.get('/b', function (req, res) {
			res.json({greeting: req.query.greeting});
		});

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				http.get('http://localhost:3600/a', concatJson(resolve, reject)).on('error', reject);
			}))
			.then(function (res) {
				assert.deepEqual(res.parsedJson, {greeting: 'hello'});
				assert.deepEqual(res.responseUrl, 'http://localhost:3600/b?greeting=hello');
			})
			.nodeify(done);
	});

	it('should allow aborting', function (done) {
		var request;

		app.get('/a', redirectsTo('/b'));
		app.get('/b', redirectsTo('/c'));
		app.get('/c', callAbort);

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				request = http.get('http://localhost:3600/a', resolve);
				request.on('response', reject);
				request.on('error', reject);
				request.on('abort', onAbort);
				function onAbort() {
					request.removeListener('error', reject);
					request.on('error', noop);
					resolve();
				}
			}))
			.nodeify(done);

		function callAbort() {
			request.abort();
		}
	});

	it('should provide flushHeaders', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', sendsJson({foo: 'bar'}));

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var request = http.get('http://localhost:3600/a', resolve);
				request.flushHeaders();
				request.on('response', resolve);
				request.on('error', reject);
			}))
			.nodeify(done);
	});

	it('should provide setNoDelay', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', sendsJson({foo: 'bar'}));

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var request = http.get('http://localhost:3600/a', resolve);
				request.setNoDelay(true);
				request.on('response', resolve);
				request.on('error', reject);
			}))
			.nodeify(done);
	});

	it('should provide setSocketKeepAlive', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', sendsJson({foo: 'bar'}));

		server.start(app)
			.then(asPromise(function (resolve) {
				var request = http.get('http://localhost:3600/a', resolve);
				request.setSocketKeepAlive(true);
			}))
			.nodeify(done);
	});

	it('should provide setTimeout', function (done) {
		app.get('/a', redirectsTo('/b'));
		app.get('/b', sendsJson({foo: 'bar'}));

		server.start(app)
			.then(asPromise(function (resolve) {
				var request = http.get('http://localhost:3600/a', resolve);
				request.setTimeout(1000);
			}))
			.nodeify(done);
	});

	describe('should obey a `maxRedirects` property', function () {
		beforeEach(function () {
			var i = 22;
			while (i > 0) {
				app.get('/r' + i, redirectsTo('/r' + --i));
			}
			app.get('/r0', sendsJson({foo: 'bar'}));
		});

		it('which defaults to 21', function (done) {
			server.start(app)
				// 21 redirects should work fine
				.then(asPromise(function (resolve, reject) {
					http.get('http://localhost:3600/r21', concatJson(resolve, reject)).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(res.parsedJson, {foo: 'bar'});
					assert.deepEqual(res.responseUrl, 'http://localhost:3600/r0');
				})
				// 22 redirects should fail
				.then(asPromise(function (resolve, reject) {
					http.get('http://localhost:3600/r22', reject).on('error', resolve);
				}))
				.then(function (err) {
					assert.ok(err.toString().match(/Max redirects exceeded/));
				})
				.nodeify(done);
		});

		it('which can be set globally', function (done) {
			followRedirects.maxRedirects = 22;
			server.start(app)
				.then(asPromise(function (resolve, reject) {
					http.get('http://localhost:3600/r22', concatJson(resolve, reject)).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(res.parsedJson, {foo: 'bar'});
					assert.deepEqual(res.responseUrl, 'http://localhost:3600/r0');
				})
				.nodeify(done);
		});

		it('set as an option on an individual request', function (done) {
			var u = url.parse('http://localhost:3600/r2');
			u.maxRedirects = 1;

			server.start(app)
				.then(asPromise(function (resolve, reject) {
					http.get(u, reject).on('error', resolve);
				}))
				.then(function (err) {
					assert.ok(err.toString().match(/Max redirects exceeded/));
				})
				.nodeify(done);
		});
	});

	describe('should switch to safe methods when appropriate', function () {
		function mustUseSameMethod(statusCode, useSameMethod) {
			describe('when redirecting with status code ' + statusCode, function () {
				itRedirectsWith(statusCode, 'GET', 'GET');
				itRedirectsWith(statusCode, 'HEAD', 'HEAD');
				itRedirectsWith(statusCode, 'OPTIONS', 'OPTIONS');
				itRedirectsWith(statusCode, 'TRACE', 'TRACE');
				itRedirectsWith(statusCode, 'POST', useSameMethod ? 'POST' : 'GET');
				itRedirectsWith(statusCode, 'PUT', useSameMethod ? 'PUT' : 'GET');
			});
		}

		function itRedirectsWith(statusCode, method, expectedMethod) {
			var description = 'should ' +
					(method === expectedMethod ? 'reuse ' + method :
						'switch from ' + method + ' to ' + expectedMethod);
			it(description, function (done) {
				app[method.toLowerCase()]('/a', redirectsTo(statusCode, '/b'));
				app[expectedMethod.toLowerCase()]('/b', sendsJson({a: 'b'}));

				server.start(app)
					.then(asPromise(function (resolve, reject) {
						var opts = url.parse('http://localhost:3600/a');
						opts.method = method;
						http.request(opts, resolve).on('error', reject).end();
					}))
					.then(function (res) {
						assert.deepEqual(res.responseUrl, 'http://localhost:3600/b');
						if (res.statusCode !== 200) {
							throw new Error('Did not use ' + expectedMethod);
						}
					})
					.nodeify(done);
			});
		}

		mustUseSameMethod(300, false);
		mustUseSameMethod(301, false);
		mustUseSameMethod(302, false);
		mustUseSameMethod(303, false);
		mustUseSameMethod(307, true);
	});

	describe('should handle cross protocol redirects ', function () {
		it('(https -> http -> https)', function (done) {
			app.get('/a', redirectsTo('http://localhost:3600/b'));
			app2.get('/b', redirectsTo('https://localhost:3601/c'));
			app.get('/c', sendsJson({yes: 'no'}));

			BPromise.all([server.start(httpsOptions(app)), server.start(app2)])
				.then(asPromise(function (resolve, reject) {
					var opts = url.parse('https://localhost:3601/a');
					opts.ca = ca;
					https.get(opts, concatJson(resolve, reject)).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(res.parsedJson, {yes: 'no'});
					assert.deepEqual(res.responseUrl, 'https://localhost:3601/c');
				})
				.nodeify(done);
		});

		it('(http -> https -> http)', function (done) {
			app.get('/a', redirectsTo('https://localhost:3601/b'));
			app2.get('/b', redirectsTo('http://localhost:3600/c'));
			app.get('/c', sendsJson({hello: 'goodbye'}));

			BPromise.all([server.start(app), server.start(httpsOptions(app2))])
				.then(asPromise(function (resolve, reject) {
					var opts = url.parse('http://localhost:3600/a');
					opts.ca = ca;
					http.get(opts, concatJson(resolve, reject)).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(res.parsedJson, {hello: 'goodbye'});
					assert.deepEqual(res.responseUrl, 'http://localhost:3600/c');
				})
				.nodeify(done);
		});
	});

	it('should support writing into request stream without redirects', function (done) {
		app.post('/a', function (req, res) {
			req.pipe(res);
		});

		var opts = url.parse('http://localhost:3600/a');
		opts.method = 'POST';

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var req = http.request(opts, resolve);
				req.end(fs.readFileSync(__filename), 'buffer');
				req.on('error', reject);
			}))
			.then(asPromise(function (resolve, reject, res) {
				var str = '';
				res.on('data', function (chunk) {
					str += chunk.toString('utf8');
				});
				res.on('end', function () {
					resolve(str);
				});
			}))
			.then(function (str) {
				assert.equal(str, fs.readFileSync(__filename, 'utf8'));
			})
			.nodeify(done);
	});

	it('should support writing into request stream with redirects', function (done) {
		app.post('/a', redirectsTo(307, 'http://localhost:3600/b'));
		app.post('/b', function (req, res) {
			req.pipe(res);
		});

		var opts = url.parse('http://localhost:3600/a');
		opts.method = 'POST';

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var req = http.request(opts, resolve);
				req.end(fs.readFileSync(__filename), 'buffer');
				req.on('error', reject);
			}))
			.then(asPromise(function (resolve, reject, res) {
				var str = '';
				res.on('data', function (chunk) {
					str += chunk.toString('utf8');
				});
				res.on('end', function () {
					resolve(str);
				});
			}))
			.then(function (str) {
				assert.equal(str, fs.readFileSync(__filename, 'utf8'));
			})
			.nodeify(done);
	});

	it('should support piping into request stream without redirects', function (done) {
		app.post('/a', function (req, res) {
			req.pipe(res);
		});

		var opts = url.parse('http://localhost:3600/a');
		opts.method = 'POST';

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var req = http.request(opts, resolve);
				fs.createReadStream(__filename).pipe(req);
				req.on('error', reject);
			}))
			.then(asPromise(function (resolve, reject, res) {
				var str = '';
				res.on('data', function (chunk) {
					str += chunk.toString('utf8');
				});
				res.on('end', function () {
					resolve(str);
				});
			}))
			.then(function (str) {
				assert.equal(str, fs.readFileSync(__filename, 'utf8'));
			})
			.nodeify(done);
	});

	it('should support piping into request stream with redirects', function (done) {
		app.post('/a', redirectsTo(307, 'http://localhost:3600/b'));
		app.post('/b', function (req, res) {
			req.pipe(res);
		});

		var opts = url.parse('http://localhost:3600/a');
		opts.method = 'POST';

		server.start(app)
			.then(asPromise(function (resolve, reject) {
				var req = http.request(opts, resolve);
				fs.createReadStream(__filename).pipe(req);
				req.on('error', reject);
			}))
			.then(asPromise(function (resolve, reject, res) {
				var str = '';
				res.on('data', function (chunk) {
					str += chunk.toString('utf8');
				});
				res.on('end', function () {
					resolve(str);
				});
			}))
			.then(function (str) {
				assert.equal(str, fs.readFileSync(__filename, 'utf8'));
			})
			.nodeify(done);
	});

	describe('when the followRedirects option is set to false', function () {
		it('does not redirect', function (done) {
			app.get('/a', redirectsTo(302, '/b'));
			app.get('/b', sendsJson({a: 'b'}));

			server.start(app)
				.then(asPromise(function (resolve, reject) {
					var opts = url.parse('http://localhost:3600/a');
					opts.followRedirects = false;
					http.get(opts, resolve).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(res.statusCode, 302);
					assert.deepEqual(res.responseUrl, 'http://localhost:3600/a');
				})
				.nodeify(done);
		});
	});

	describe('should choose the right agent per protocol', function () {
		it('(https -> http -> https)', function (done) {
			app.get('/a', redirectsTo('http://localhost:3600/b'));
			app2.get('/b', redirectsTo('https://localhost:3601/c'));
			app.get('/c', sendsJson({yes: 'no'}));

			var httpAgent = addRequestLogging(new http.Agent());
			var httpsAgent = addRequestLogging(new https.Agent());
			function addRequestLogging(agent) {
				agent._requests = [];
				agent._addRequest = agent.addRequest;
				agent.addRequest = function (request, options) {
					this._requests.push(options.path);
					this._addRequest(request, options);
				};
				return agent;
			}

			BPromise.all([server.start(httpsOptions(app)), server.start(app2)])
				.then(asPromise(function (resolve, reject) {
					var opts = url.parse('https://localhost:3601/a');
					opts.ca = ca;
					opts.agents = {http: httpAgent, https: httpsAgent};
					https.get(opts, concatJson(resolve, reject)).on('error', reject);
				}))
				.then(function (res) {
					assert.deepEqual(httpAgent._requests, ['/b']);
					assert.deepEqual(httpsAgent._requests, ['/a', '/c']);
					assert.deepEqual(res.parsedJson, {yes: 'no'});
					assert.deepEqual(res.responseUrl, 'https://localhost:3601/c');
				})
				.nodeify(done);
		});
	});
});

function noop() {}
