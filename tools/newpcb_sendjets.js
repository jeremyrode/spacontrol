const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var MUXPin = new Gpio(5, 'out'); //declare GPIO5 an output

const long_pattern = Buffer.alloc(6,'036b00000166','hex');
const short_pattern = Buffer.alloc(4,'014b0144', 'hex');
const jets_pattern = Buffer.alloc(10 ,'584D5300036b00100176', 'hex');


const port = new SerialPort('/dev/serial0', {
  baudRate: 115200
})

const parser = port.pipe(new Delimiter({delimiter: new Buffer('584D5300','hex') }));
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
  mux_on();
  setTimeout(sendJetsPat,100);
  setTimeout(sendJetsPat,140);
  setTimeout(sendJetsPat,180);
  setTimeout(sendJetsPat,220);
  setTimeout(sendJetsPat,260);
  setTimeout(sendJetsPat,300);
  setTimeout(sendJetsPat,340);
  setTimeout(sendJetsPat,380);
  setTimeout(sendJetsPat,420);
  setTimeout(sendJetsPat,480);
  setTimeout(mux_off,500);
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
