const https = require('https');
const http = require('http');
const port = process.env.PORT || 80;

const server = http.createServer().listen(port);
const qs = require('querystring');

server.on('request', (req, res) => {
  const url = qs.unescape(req.url.replace('/',''))
  
  let body = "";
   req.on("data", (chunk) => {
     body += chunk; // convert Buffer to string
   });
   req.on("end", () => {
     const result = JSON.parse(body);
     // change timestamp to correct one
     const items = result._id.split("::");
     const now = new Date()
     result._id = `${now.toISOString()}::${items[1]}::${items[2]}`
     const data = JSON.stringify(result)
     
     const connection = https.request(url, {
       method: req.method,
       headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
       rejectUnauthorized: false
     }, (resp) => {
       resp.pipe(res);
     });
     connection.write(data)
   });
});