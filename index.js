//YNCA PLATFORM

var net = require("net");
var Service, Characteristic, Accessory, uuid;
var inherits = require('util').inherits;
var extend = require('util')._extend;

var clients = [];
var connecteds = []
var powerIOs = [];
var volumeIOs = [];
var sourceIOs = [];


/* Register the plugin with homebridge */
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-yamaha-YNCA", "YNCA", YNCAPlatform);
}

function YNCAPlatform(log, config) {
    this.log = log;
    this.devices = config.devices;
}

YNCAPlatform.prototype.accessories = function (callback) {
    if (Array.isArray(this.devices)) {
        var devicesProcessed = 0;
        var results = [];
        for (var deviceIndex = 0; deviceIndex < this.devices.length; deviceIndex++) {
            var currentDeviceConfig = this.devices[deviceIndex];

            //clientsCurrentIO.push(firstcurrentIO);
            clients.push(new net.Socket());
            var client = clients[deviceIndex];
            client.log = this.log;
            connecteds.push(false)
            var connected = connecteds[deviceIndex]
            powerIOs.push([]);
            var powerIO = powerIOs[deviceIndex];
            volumeIOs.push([]);
            var volumeIO = volumeIOs[deviceIndex];
            sourceIOs.push([]);
            var sourceIO = sourceIOs[deviceIndex];

            var port = currentDeviceConfig.port;
            var host = currentDeviceConfig.host;

            client.connect(port, host, function () {
                this.log("Connected to " + host + ":" + port);
                connected = true
                client.write('@MAIN:PWR=?\r\n');
            });

            setInterval(function(self) {
                if(connected) {
                    client.write('@SYS:MODELNAME=?\r\n')
                }
            }, 30000, this);

            client.on('close', function () {
                connected = false
                client.connect(port, host, function () {
                    connected = true
                    //this.log("Connected to " + host + ":" + port);
                });
            });

            // client.setTimeout(10000, function (err) {
            //     this.log("Timed out connecting to " + host + ":" + port);
            //     callback([]);
            //     client.destroy();
            // });

            var responseCount = 0;
            var finishedLoadingDevices = false;


            client.on('data', function (data) {
                if(!finishedLoadingDevices) {
                    var response = data.toString('utf-8').trim();

                    var responseItems = response.split("\n")
                    responseItems.forEach(function(item) {
                      if(item.includes("MAIN:PWR")){
                        var power = item.split("=")[1];
                        console.log("Power: " + power);
                        if(power === "On") {
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
                    if(responseCount == 3) {
                        console.log(powerIO);
                        console.log(sourceIO);
                        console.log(volumeIO);
                        finishedLoadingDevices = true;

                        results.push(new YNCAOutput(this.log, currentDeviceConfig, powerIO, sourceIO, volumeIO, client));
                        devicesProcessed++;
                        if (results.length === 0) {
                              this.log("WARNING: No Accessories were loaded.");
                        }
                        callback(results)
                    }
                }
            });
        }
    } else {
        this.log("Error parsing config file");
    }
}

function YNCAOutput(log, config, power, source, volume, client) {
    this.log = log;
    this.name = config.name;
    this.inputs = []
    this.services = []
    this.client = client
    this.power = power
    this.volume = volume
    this.source = source

    this.log("Configuring YNCA output: " + config.name);

    for(var i = 0; i < config.inputs.length; i++){
        if (config.inputs[i] !== "") {
            this.addInput(new YNCAInput(this.log, config.inputs[i] + " " + config.name, config.inputs[i], this.source, this.client))
        }
    }

    this.powerService = new YNCAPower(this.log, this.name, this.power, this.client)
    this.addPower(this.powerService)

    this.volumeService = new YNCAVolume(this.log, this.name, this.volume, this.client)
    this.addVolume(this.volumeService)

    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Manufacturer, 'Yamaha')
        .setCharacteristic(Characteristic.Model, config.name)
        .setCharacteristic(Characteristic.SerialNumber, config.name);

    this.services.push(informationService);

    this.client.on('data', function (data) {
        var response = data.toString('utf-8').trim();
        var checkready = response.split("\n");
        var responseItems = response.split("\n")
        responseItems.forEach(function(item) {
            if(item.includes("MAIN:PWR")) {
                var power = item.split("=")[1];
                if(power === "On") {
                    this.power = true
                } else {
                    this.power = false
                }
                this.powerService.setSelfState(this.power);
            } else if(item.includes("MAIN:INP")) {
                var source = item.split("=")[1];
                this.source = source
                this.inputs.forEach(function(input) {
                    input.setSelfState(source)
                });
            } else if(item.includes("MAIN:VOL")){
                var volume = item.split("=")[1];
                this.volume = convertVolumetoPercent(volume)
                this.volumeService.setSelfState(convertVolumetoPercent(volume));
            }
        }.bind(this))
    }.bind(this));

    this.client.on('close', function () {
        //this.log("Connection lost to " + this.name);
    }.bind(this));
}

YNCAOutput.prototype.addInput = function (newInput) {
    this.inputs.push(newInput);
    this.services.push(newInput.getService());
}

YNCAOutput.prototype.addVolume = function (newVolume) {
    this.services.push(newVolume.getService());
}

YNCAOutput.prototype.addPower = function (newPower) {
    this.services.push(newPower.getService());
}

YNCAOutput.prototype.getServices = function () {
    return this.services
}

/////////////////////INPUT
function YNCAInput(log, name, input, currentInput, client) {
    this.name = name;
    this.input = input;
    this.log = log;
    this.client = client;

    this.service = new Service.Switch(this.name);
    this.service.subtype = name;
    this.service
        .getCharacteristic(Characteristic.On)
        .on('set', this.setState.bind(this))
        .on('get', this.getState.bind(this));

    this.currentInput = currentInput
    this.state = true;
    this.setSelfState(currentInput)

    this.log(this.name);
}

YNCAInput.prototype.getService = function() {
    this.log(this.name + " getService");
    return this.service;
}

YNCAInput.prototype.getState = function (callback) {
    callback(null, this.state);
}


YNCAInput.prototype.setState = function (state, callback) {
    this.state = state;
    this.currentInput = this.input

    if (this.selfSet) {
      this.selfSet = false;
      callback(null);
      return;
    }

    if(state){
        var command = "@MAIN:INP=" + this.input ;
        this.client.write(command + "\r\n");
        this.log(command)
        var date = new Date()
        do { curDate = new Date(); }
        while(curDate-date < 200);
    }

    callback(null);
}

YNCAInput.prototype.setSelfState = function (currentInput) {
    var curInput = " " + currentInput;
    var state = false;
    if (this.input === curInput.trim()) {
      state = true
    }
    if(this.state !== state) {
        this.state = state;
        this.selfSet = true;
        this.service
          .getCharacteristic(Characteristic.On)
          .setValue(state);
    }
}


/////////////////////POWER
function YNCAPower(log, name, state, client) {
    this.name = name + " Sound";
    this.log = log;
    this.client = client;
    this.state = state

    this.service = new Service.Switch(this.name);
    this.service.subtype = "power";
    this.service
        .getCharacteristic(Characteristic.On)
        .on('set', this.setState.bind(this))
        .on('get', this.getState.bind(this));


    this.setSelfState(state);
    this.log(this.name);
}

YNCAPower.prototype.getService = function() {
    this.log(this.name + " getService");
    return this.service;
}

YNCAPower.prototype.getState = function (callback) {
    callback(null, this.state);
}


YNCAPower.prototype.setState = function (state, callback) {
    var changedState = 'Standby'
    if(state){
        changedState = 'On'
    }
    var command = "@MAIN:PWR=" + changedState ;
    this.state = state;

    if (this.selfSet) {
      this.selfSet = false;
      callback(null);
      return;
    }

    this.client.write(command + "\r\n");
    this.log(command)
    var date = new Date()
    do { curDate = new Date(); }
    while(curDate-date < 200);
    this.client.write("@MAIN:INP=?\r\n");
    callback(null);
}

YNCAPower.prototype.setSelfState = function (state) {
    this.selfSet = true;
    this.service
      .getCharacteristic(Characteristic.On)
      .setValue(state);
}

/////////////////////VOLUME
function YNCAVolume(log, name, volume, client) {
    this.name = name + " Volume";
    this.log = log;
    this.client = client;
    this.state = true;
    this.volume = volume;

    this.service = new Service.Lightbulb(this.name);
    this.service.subtype = "volume";
    this.service
        .getCharacteristic(Characteristic.On)
        .on('set', this.setState.bind(this))
        .on('get', this.getState.bind(this));

    this.service
        .getCharacteristic(Characteristic.Brightness)
        .on('set', this.setBrightness.bind(this))
        .on('get', this.getBrightness.bind(this));


    this.setSelfState(volume);
    this.log(this.name);
}

YNCAVolume.prototype.getService = function() {
    this.log(this.name + " getService");
    return this.service;
}

YNCAVolume.prototype.getState = function (callback) {
    callback(null, this.state);
}


YNCAVolume.prototype.setState = function (state, callback) {
    callback(null);
}

YNCAVolume.prototype.getBrightness = function (callback) {
    callback(null, this.volume);
}

YNCAVolume.prototype.setBrightness = function (state, callback) {
    var command = "@MAIN:VOL=" + convertPercenttoVolume(state) ;
    this.volume = state;

    if (this.selfSet) {
      this.selfSet = false;
      callback(null);
      return;
    }

    this.client.write(command + "\r\n");
    this.log(command)
    var date = new Date()
    do { curDate = new Date(); }
    while(curDate-date < 200);
    callback(null);
}

YNCAVolume.prototype.setSelfState = function (state) {
    this.selfSet = true;
    this.service
      .getCharacteristic(Characteristic.Brightness)
      .setValue(state);
}

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
    } else {
        volOut = volNum
    }
    return volOut
}
