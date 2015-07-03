var testServer = require('./test/lib/test-server');

var express = require('express');
var app = express();

app.get('/a', function(req, res) {
  res.redirect('/b');
});

app.get('/b', function(req, res) {
  res.json({a:'b'});
});

testServer.start(app, 'https');