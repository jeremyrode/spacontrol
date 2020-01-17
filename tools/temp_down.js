#!/usr/bin/node
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var MUXPin = new Gpio(5, 'out'); //declare GPIO5 an output

const long_pattern =  Buffer.alloc(10,'584D5300036b00000166','hex'); //No button pressed pattern
const temp_down =     Buffer.alloc(10,'584D5300036b0008016e', 'hex');

const delay = 40;
const numcommand = 40; //How many total commands to send (first one is lost) 80 is min, no harm in extra
const repcommand = 5; //How many repeats for each command 10 is too many, registers mutiple sometimes
var i;
var x;

const port = new SerialPort('/dev/serial0', {
  baudRate: 115200
})

function mux_on() {
	MUXPin.writeSync(1);
}

function mux_off() {
	MUXPin.writeSync(0);
}

function sendDown() {
	port.write(temp_down);
}

function sendIdle() {
	port.write(long_pattern);
}

mux_on(); // Take control of the serial bus
//Cue up a bunch of virtual button presses!
for (i = 1; i < numcommand*repcommand*2; i+=repcommand*2) {
  for (x = 0; x < repcommand; x++) {
    setTimeout(sendDown,(i+x)*delay);
  }
  for (x = repcommand; x < repcommand*2; x++) {
    setTimeout(sendIdle,(i+x)*delay);
  }
}
setTimeout(mux_off,i*delay); //Give back control of the bus
