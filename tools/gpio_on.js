var Gpio = require('onoff').Gpio; //require onoff to control GPIO
var LEDPin = new Gpio(5, 'out'); //declare GPIO4 an output

LEDPin.writeSync(1);
