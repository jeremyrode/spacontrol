#!/usr/bin/node
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');
//These are the "OLD" Patterns
/*
const long_pattern = Buffer.alloc(6,'036b00000166','hex');
const short_pattern = Buffer.alloc(4,'014b0144', 'hex');
const jets_pattern = Buffer.alloc(10 ,'584D5300036b00100176', 'hex');
const preamble = Buffer.alloc(4,'584D5300','hex');
*/
//Patterns Seen on 11/26/2020
const long_pattern1 = Buffer.alloc(6,'031a00030118','hex');
const long_pattern2 = Buffer.alloc(6,'031a00830198','hex');
const long_pattern3 = Buffer.alloc(6,'031b2710014d','hex');
const long_pattern4 = Buffer.alloc(6,'031a008b01a0','hex');
const short_pattern = Buffer.alloc(4,'010000f9', 'hex');
const preamble = Buffer.alloc(4,'58534d00','hex');


const port = new SerialPort('/dev/ttyAMA0', {
  baudRate: 115200
})

const parser = port.pipe(new Delimiter({delimiter: preamble }));
parser.on('data', function(data) {onDiffData(data);});

function onDiffData(sdata) {
	if (long_pattern1.compare(sdata) != 0 && long_pattern2.compare(sdata) != 0 && long_pattern3.compare(sdata) != 0 && long_pattern4.compare(sdata) != 0 && short_pattern.compare(sdata) != 0) {
		console.log(sdata);
	}
}

setInterval(function() {console.log('I am Here!');},100000);


// Temp up gues <Buffer 08 05 20 31 30 31 46 20 00 02 1d>
