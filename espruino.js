const A0 = NodeMCU.D0;
const A1 = NodeMCU.D1;

const wifi = require("Wifi");
const http = require("http");
// NodeMCU.D5 - CLK, NodeMCU.D6 - DIO ports
const display = require("https://github.com/xMlex/TM1637/blob/master/TM1637.js").connect(NodeMCU.D5, NodeMCU.D6);

function connectWifi() {
  return new Promise((resolve,reject) => {
    wifi.connect("HofPahmeyer", {password:"eggebergerstrasse37"}, function(ap){
      console.log("connected:", ap); 
      if (ap) return reject();
      // turn on LED if WIFI found
      digitalWrite(2, 0);
      resolve();
    });
    wifi.save();
  }); 
}

function setCorrectTime() {
  return new Promise(resolve => {
    http.get('http://icanhazip.com/', function (res) {
      setTime(new Date(res.headers.Date)/1000);      
      resolve()
    });
  })
}

function post(postURL, data) {
  return new Promise((resolve,reject) => {
    content = JSON.stringify(data);
    var options = url.parse(postURL);
    options.method = 'POST';
    options.headers = {
      "Content-Type":"application/json",
      "Content-Length":content.length
    };
    var req = require("http").request(options, function(res)  {
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      var d = "";
      res.on('data', function(data) { d+= data; });
      res.on('close', function(data) { resolve(d); });
    });
    req.on('error', function(e) {
      // log error to console, but don't break
      reject(e);
      console.log(e);
    });
    req.end(content);
  });
}

function calcVolume(dist) {
  const h = 160;
  const r = h/2;
  const l = 240;
  const filled = h-dist;
  const A1 = Math.acos((r-filled)/r) * Math.pow(r,2);
  const param = (2*r*filled)-Math.pow(filled,2);
  const A2 = (r-filled)*Math.sqrt(param);
  const A = A1 - A2;
  return A*l * 0.001;
}

function median(numbers) {
  const middle = (numbers.length + 1) / 2;
  const sorted = numbers.sort((a, b) => a - b); // you have to add sorting function for numbers
  const isEven = sorted.length % 2 === 0;
  return isEven ? (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2 : sorted[middle - 1];
}

let values = [];
let lastUploadTime = 0;

const sensor = require("HC-SR04").connect(A0,A1,function(dist) {
  // console.log(dist+" cm away");
  // console.log(values.length)
  const now = new Date()
  const timeDiff = (now - lastUploadTime) / (1000 * 60);
  const hour = now.getHours();
  // console.log(hour, timeDiff, values.length)
  // only upload data between 5h - 24h, due to Heroku Dyno limit of 18h/d
  if (hour > 5 && timeDiff > 30 && values.length > 10) {
    const last10 = values.slice(-10);
    const medianDist = median(last10);
    const volume = calcVolume(medianDist);
    const id = `${now.toISOString()}::${Math.round(medianDist)}:: ${Math.round(volume)}`;
    console.log(`Dist: ${Math.round(medianDist)}, Vol: ${Math.round(volume)}`);
    post('http://tankstelle.herokuapp.com/https%3A%2F%2Ffruchtfolge.agp.uni-bonn.de%2Fdb%2Ffuellstand%2F', { _id: id } );
    values = [];
    lastUploadTime = now;
  } else {
    values.push(dist)
  }
  
  // update display with latest value
  if (values.length > 10) {
    const last10Disp = values.slice(-10);
    const medianDisp = median(last10Disp);
    const volumeDisp = calcVolume(medianDisp);
    display.show(Math.round(volumeDisp).toString())
  } else {
    display.show(Math.round(calcVolume(dist)).toString())
  }
  
  
});

// trigger sensor once even before WiFi is found
// this way, if the WiFi is down (as usual)
// the display still gets updated, since the script will 
// constantly be re-started
sensor.trigger()

connectWifi()
  .then(setCorrectTime)
  .then(() => {
    const measure = setInterval(function() {
      sensor.trigger();
    }, 5000);
  })
  .catch(console.log);
