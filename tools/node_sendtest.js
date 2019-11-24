const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

const long_pattern = Buffer.alloc(6,'036b00000166','hex');
const short_pattern = Buffer.alloc(4,'014b0144', 'hex');
const jets_pattern = Buffer.alloc(10 ,'584D5300036b00100176', 'hex');
const    full_long = Buffer.alloc(10 ,'584D5300036b00000166', 'hex');
const    temp_down = Buffer.alloc(10 ,'584D5300036b0008016e', 'hex');

const port = new SerialPort('/dev/ttyAMA0', {
  baudRate: 115200,
  stopBits: 2
})

const parser = port.pipe(new Delimiter({delimiter: new Buffer('584D5300','hex') }));
parser.on('data', function(data) {onDiffData(data);});

function onDiffData(sdata) {
	if (long_pattern.compare(sdata) != 0 && short_pattern.compare(sdata) != 0) {
		console.log(sdata);
	}
}

setInterval(function() {console.log('I am Here!');},10000);
setInterval(sendJets,40);

function sendJets() {
	port.write(full_long);
//	port.write(temp_down);
}

