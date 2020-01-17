#!/usr/bin/node
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var MUXPin = new Gpio(5, 'out'); //declare GPIO5 an output

const long_pattern =  Buffer.alloc(10,'584D5300036b00000166','hex'); //No button pressed pattern
const temp_down =     Buffer.alloc(10,'584D5300036b0008016e', 'hex');

const delay = 40;
const rep = 40;
var i;

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
for (i = 1; i <= rep*2; i+=2) {
  setTimeout(sendDown,i*delay);
  setTimeout(sendIdle,(i+1)*delay);
}
setTimeout(mux_off,i*delay); //Give back control of the bus
