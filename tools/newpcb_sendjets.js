const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var MUXPin = new Gpio(5, 'out'); //declare GPIO5 an output

const header =        Buffer.alloc(4  ,'584D5300','hex'); //Header for every command
const long_pattern =  Buffer.alloc(6  ,'036b00000166','hex'); //No button pressed pattern
const short_pattern = Buffer.alloc(4  ,'014b0144', 'hex'); //Unsure but it perodically appears
const jets_pattern =  Buffer.alloc(10 ,'584D5300036b00100176', 'hex'); //jets button
const temp_up =       Buffer.alloc(10 ,'584D5300036b0008016e', 'hex');
const temp_down =     Buffer.alloc(10 ,'584D5300036b00020168', 'hex');
const lights =        Buffer.alloc(10 ,'584D5300036b00200186', 'hex');


const port = new SerialPort('/dev/serial0', {
  baudRate: 115200
})

const parser = port.pipe(new Delimiter({delimiter: header }));
parser.on('data', function(data) {onDiffData(data);});

function onDiffData(sdata) {
	if (long_pattern.compare(sdata) != 0 && short_pattern.compare(sdata) != 0) {
		console.log(sdata);
	}
}

//setInterval(function() {console.log('I am Here!');},10000);

setInterval(sendJets,10000);

function sendJets() {
  console.log('Sending Jets');
  mux_on(); // Take control of the serial bus
  setTimeout(sendJetsPat,40); //sent the command 40 ms later
  setTimeout(mux_off,80); //Give back control of the bus
	console.log('Sent Jets');
}

function mux_on() {
	MUXPin.writeSync(1);
}

function mux_off() {
	MUXPin.writeSync(0);
}

function sendJetsPat() {
	port.write(jets_pattern);
}
