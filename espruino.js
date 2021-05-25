const A0 = NodeMCU.D0;
const A1 = NodeMCU.D1;

const wifi = require("Wifi");
const http = require("http");

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

let lastValue = 0;
let values = [];

const sensor = require("HC-SR04").connect(A0,A1,function(dist) {
  // console.log(dist+" cm away");
  // console.log(values.length)
  if (values.length < 10) {
    values.push(dist);
  } else {
    const medianDist = median(values);
      if (medianDist > lastValue * 1.05 || medianDist < lastValue * 0.95) {
      const volume = calcVolume(medianDist);
      const time = new Date();
      const id = `${time.toISOString()}::${Math.round(medianDist)}:: ${Math.round(volume)}`;
      console.log(`Dist: ${Math.round(medianDist)}, Vol: ${Math.round(volume)}`);
      post('http://tankstelle.herokuapp.com/https%3A%2F%2Ffruchtfolge.agp.uni-bonn.de%2Fdb%2Ffuellstand%2F', { _id: id } );
      lastValue = medianDist;
  } else {
    console.log(medianDist,lastValue);
  }
    values = [];
  }

});

function startMeasure() {
  // measure 10 times
  let counter = 0;
  const measure = setInterval(function() {
    sensor.trigger(); // send pulse
    // console.log(counter);
    counter += 1;
    if (counter > 10) {
      clearInterval(measure);
    }
  }, 5000);
}
connectWifi()
  .then(setCorrectTime)
  .then(() => {
    startMeasure();
    // repeat every 60 minutes
    setInterval(startMeasure, 1000 * 60 * 60);
  })
  .catch(console.log);
