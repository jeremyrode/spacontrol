#!/usr/bin/node
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var MUXPin = new Gpio(5, 'out'); //declare GPIO5, the muxpin as an output

const long_pattern =  Buffer.alloc(10,'584D5300036b00000166','hex'); //No button pressed pattern
const temp_up =       Buffer.alloc(10,'584D5300036b00020168', 'hex');

const delay = 40; //delay in ms between commands
const numcommand = 28; //How many total commands to send (first one is lost) 21 = 100 deg from 80 min
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

function sendUp() {
	port.write(temp_up);
}

function sendIdle() {
	port.write(long_pattern);
}

mux_on(); // Take control of the serial bus
//Cue up a bunch of virtual button presses!
for (i = 1; i < numcommand*repcommand*2; i+=repcommand*2) {
  for (x = 0; x < repcommand; x++) {
    setTimeout(sendUp,(i+x)*delay);
  }
  for (x = repcommand; x < repcommand*2; x++) {
    setTimeout(sendIdle,(i+x)*delay);
  }
}
setTimeout(mux_off,i*delay); //Give back control of the bus


//script will exit afer the pending timeouts
