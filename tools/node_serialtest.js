const SerialPort = require('serialport');
//const Delimiter = require('@serialport/parser-delimiter');
const ByteLength = require('@serialport/parser-byte-length')

const old_data = Buffer.alloc(10);

const port = new SerialPort('/dev/ttyAMA0', {
  baudRate: 115200
})

const parser = port.pipe(new ByteLength({length: 10}));
parser.on('data', function(data) {onDiffData(data);});

function onDiffData(sdata) {
	if (old_data.compare(sdata) != 0) {
		console.log(sdata);
		sdata.copy(old_data);
	}
}
