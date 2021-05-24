const https = require('https');
const http = require('http');
const server = http.createServer().listen(3000);
const qs = require('querystring');

server.on('request', (req, res) => {
  const url = qs.unescape(req.url.replace('/',''))
  
  const connector = https.request(url, {
    method: req.method,
    headers: req.headers,
    rejectUnauthorized: false
  }, (resp) => {
    resp.pipe(res);
  });

  req.pipe(connector);
});
