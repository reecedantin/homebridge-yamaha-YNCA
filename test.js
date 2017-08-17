var net = require("net");

var host = "192.168.0.11";
var port = 50000;
var client = new net.Socket();
client.log = console.log;
var responseCount = 0;

setInterval(function(self)
{
    if(connected) {
          console.log("connected? : " + client.write('@SYS:MODELNAME=?\r\n'));
    }
}, 30000, this);
//
// setInterval(function(self)
// {
//   client.write('q\r\n');
//   //client.destroy();
// }, 17000, this);


// client.setTimeout(10000, function (err) {
//     this.log('Timed out connecting to ' + host + ':' + port);
//
// });

var powerIO;
var sourceIO;
var volumeIO;

client.connect(port, host, function () {
    this.log("Connected to " +host + port);
    responseCount = 0;
    connected = true;
    client.write('@MAIN:PWR=?\r\n');
});

client.on('data', function (data) {
    //this.log(data.toString());
});

var responseCount = 0;

client.on('data', function (data) {
    var response = data.toString('utf-8').trim();

    var responseItems = response.split("\n")
    responseItems.forEach(function(item) {
      console.log(item)
      if(item.includes("MAIN:PWR")){
        var power = item.split("=")[1];
        console.log("Power: " + power);
        if(power == "On") {
            powerIO = true
        } else {
            powerIO = false
        }
        client.write('@MAIN:INP=?\r\n')
      } else if(item.includes("MAIN:INP")){
        var source = item.split("=")[1];
        sourceIO = source
        console.log("Source: " + source);
        client.write('@MAIN:VOL=?\r\n')
      } else if(item.includes("MAIN:VOL")){
        var volume = item.split("=")[1];
        volumeIO = convertVolumetoPercent(volume)
        console.log("Volume: " + volume + ", " + convertVolumetoPercent(volume) + "%");
      }
    })

    responseCount++
    if(responseCount == 3){
      console.log(powerIO);
      console.log(sourceIO);
      console.log(volumeIO);
    }
});

client.on('close', function () {
    responseCount = 0;
    connected = false;
    this.log("Closed Nicely");
    client.destroy();
});

client.on('error', function (err) {
    this.log('Error' + err);
    client.destroy();
});

client.on('timeout', function () {
    this.log("Timed out connecting");
    //callback(deviceIndex, "Timed out");
    client.destroy();
});

function convertVolumetoPercent(volume) { //-5.0 to -80.5
    var volNum = parseFloat(volume)
    var volPercent = 0;

    volPercent = Math.round((volNum + 80.5)/(75.5)*100)
    return volPercent
}


function convertPercenttoVolume(percent) { //-5.0 to -80.5
    var volPercent = percent;
    var volNum = -80.5;
    var volOut = ""

    volNum = Math.round((((volPercent/100)*75.5) - 80.5)*2)/2
    if((volNum%2) === 1 || (volNum%2) === 0 || (volNum%2) === -1){
        volOut = volNum + ".0"
        console.log("add")
    } else {
        volOut = volNum + ""
    }
    return volOut
}
