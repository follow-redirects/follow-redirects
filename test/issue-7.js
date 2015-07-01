var http = require('../').http;

http.get('http://bit.ly/1bO0scI', function (res) {
  var all = '';
  res.on('data', function (chunk) {
    all = all + chunk;
    console.log(all.toString().length);
  });

  res.on('end', function (chunk) {
    console.log(all);
    console.log(all.toString().length);
  });
}).on('error', function (err) {
  console.error(err);
});
