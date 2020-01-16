var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var LEDPin = new Gpio(5, 'out'); //declare GPIO4 an output

var state = false;

setInterval(toggleGPIO,5000)

function toggleGPIO() {
	state = !state;
	LEDPin.writeSync(+state);
}
