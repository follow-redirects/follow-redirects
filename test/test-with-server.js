describe('follow-redirects', function() {
  var express = require('express');
  var concat = require('concat-stream');
  var assert = require('assert');
  var server = require('./lib/test-server');
  var url = require('url');
  var followRedirects = require('..');
  var http = followRedirects.http;
  var https = followRedirects.https;
  var Promise = require('bluebird');

  var app, app2, originalMaxRedirects;

  beforeEach(function(){
    originalMaxRedirects = followRedirects.maxRedirects;
    app = express();
    app2 = express();
  });

  afterEach(function(done) {
    followRedirects.maxRedirects = originalMaxRedirects;
    server.stop().nodeify(done);
  });

  it('http.get', function(done) {
    app.get('/a', redirectsTo('/b'));
    app.get('/b', redirectsTo('/c'));
    app.get('/c', redirectsTo('/d'));
    app.get('/d', redirectsTo('/e'));
    app.get('/e', redirectsTo('/f'));
    app.get('/f', sendsJson({a:'b'}));

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', resolve).on('error', reject);
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {a:'b'})
      })
      .nodeify(done);
  });

  it('max Redirects defaults to 5', function(done) {
    app.get('/a', redirectsTo('/b'));
    app.get('/b', redirectsTo('/c'));
    app.get('/c', redirectsTo('/d'));
    app.get('/d', redirectsTo('/e'));
    app.get('/e', redirectsTo('/f'));
    app.get('/f', redirectsTo('/g'));
    app.get('/g', sendsJson({foo:'bar'}));

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', resolve).on('error', reject);
      }))
      .catch(function(err) {
        assert.ok(err.toString().match(/Max redirects exceeded/));
      })
      .nodeify(done);
  });

  it('max Redirects can be set globally', function(done) {
    followRedirects.maxRedirects = 6;
    app.get('/a', redirectsTo('/b'));
    app.get('/b', redirectsTo('/c'));
    app.get('/c', redirectsTo('/d'));
    app.get('/d', redirectsTo('/e'));
    app.get('/e', redirectsTo('/f'));
    app.get('/f', redirectsTo('/g'));
    app.get('/g', sendsJson({foo:'bar'}));

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', resolve).on('error', reject);
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {foo:'bar'})
      })
      .nodeify(done);
  });

  it('max Redirects can be set per request', function(done) {
    app.get('/a', redirectsTo('/b'));
    app.get('/b', redirectsTo('/c'));
    app.get('/c', sendsJson({foo:'bar'}));

    var u = url.parse('http://localhost:3600/a');
    u.maxRedirects = 1;

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get(u, resolve).on('error', reject);
      }))
      .catch(function(err) {
        assert.ok(err.toString().match(/Max redirects exceeded/));
      })
      .nodeify(done);
  });

  it('will return 300 code if no location header set', function(done) {
    app.get('/a', function(req, res){
      res.status(307).end();
    });

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', resolve).on('error', reject);
      }))
      .then(function (response) {
        assert.equal(response.statusCode, 307);
        response.on('data', function() {
          // noop to consume the stream (server won't shut down otherwise).
        });
      })
      .nodeify(done);
  });

  it('will report an error', function(done) {
    app.get('/a', redirectsTo('http://localhost:36002/b'));

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', reject).on('error', resolve);
      }))
      .then(function(error) {
        assert.equal(error.code, 'ECONNREFUSED');
      })
      .nodeify(done);
  });

  it('works using https', function(done) {
    app.get('/a', redirectsTo('/b'));
    app.get('/b', redirectsTo('/c'));
    app.get('/c', sendsJson({baz:'quz'}));

    server.start(app, 'https')
      .then(asPromise(function(resolve, reject){
        var opts = url.parse('https://localhost:3601/a');
        server.addClientCerts(opts);
        https.get(opts, resolve).on('error', reject);
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {baz:'quz'});
      })
      .nodeify(done);
  });

  it('https -> http -> https', function(done) {
    app.get('/a', redirectsTo('http://localhost:3600/b'));
    app2.get('/b', redirectsTo('https://localhost:3601/c'));
    app.get('/c', sendsJson({yes:'no'}));

    Promise.all([server.start(app,'https'), server.start(app2)])
      .then(asPromise(function(resolve, reject){
        var opts = url.parse('https://localhost:3601/a');
        server.addClientCerts(opts);
        https.get(opts, resolve).on('error', reject);
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {yes:'no'});
      })
      .nodeify(done);
  });

  it('http -> https -> http', function(done) {
    app.get('/a', redirectsTo('https://localhost:3601/b'));
    app2.get('/b', redirectsTo('http://localhost:3600/c'));
    app.get('/c', sendsJson({hello:'goodbye'}));

    Promise.all([server.start(app), server.start(app2, 'https')])
      .then(asPromise(function(resolve, reject){
        var opts = url.parse('http://localhost:3600/a');
        server.addClientCerts(opts);
        http.get(opts, resolve).on('error', reject);
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {hello:'goodbye'});
      })
      .nodeify(done);
  });

  it('redirect to query params', function(done) {
    app.get('/a', redirectsTo('/b?greeting=hello'));
    app.get('/b', function(req, res) {
      res.json({greeting:req.query.greeting});
    });

    server.start(app)
      .then(asPromise(function(resolve, reject){
        http.get('http://localhost:3600/a', resolve).on('error', reject)
      }))
      .then(concatJson)
      .then(function(json) {
        assert.deepEqual(json, {greeting:'hello'})
      })
      .nodeify(done);
  });

  function redirectsTo(opt_status, path) {
    var args = Array.prototype.slice.call(arguments);
    return function(req, res) {
      res.redirect.apply(res, args);
    }
  }

  function sendsJson(json) {
    return function(req, res) {
      res.json(json);
    }
  }

  function concatJson(res) {
    return new Promise(function (resolve, reject) {
      res.pipe(concat({encoding:'string'}, function(string){
        try {
          resolve(JSON.parse(string));
        } catch (e) {
          reject(new Error('error parsing ' + JSON.stringify(string) + '\n caused by: ' + e.message));
        }
      })).on('error', reject);
    });
  }

  function asPromise(cb) {
    return function(result) {
      return new Promise(function(resolve, reject) {
        cb(resolve, reject, result);
      });
    }
  }
});