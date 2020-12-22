#!/usr/bin/node
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

const pattern1 = Buffer.alloc(5,'1a018b01a1','hex');
//const pattern2 = Buffer.alloc(5,'1a010b0121','hex');
const pattern2 = Buffer.alloc(5,'1b2710014d','hex');
const pattern3 = Buffer.alloc(5,'1a00030118','hex');

const port = new SerialPort('/dev/serial0', {
  baudRate: 115200
})

const parser = port.pipe(new Delimiter({delimiter: new Buffer('58534D0003','hex') }));
parser.on('data', function(data) {onDiffData(data);});


function onDiffData(sdata) {
	if (pattern1.compare(sdata) != 0 && pattern2.compare(sdata) != 0 && pattern3.compare(sdata) != 0) {
		console.log(sdata);
	}
}


setInterval(function() {console.log('I am Here!');},10000);
