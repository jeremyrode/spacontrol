#!/usr/bin/node
'use strict';
const fs = require('fs');
const {google} = require('googleapis');
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');
const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const MUXPin = new Gpio(5, 'out'); //declare GPIO5, the muxpin as an output

process.title = 'GoogleCalendarDaemon';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events.public.readonly'];
const API_KEY_PATH = '/home/pi/google_api_key.json';
const LOG_FILE = '/home/pi/SpaCalendarLog.txt';
const UPDATE_INTERVAL = 30; //How often to poll Goolge canlendar In mins
const INTERVAL_OVERLAP = 1; //In mins to be sure we don't miss anything
const IDLE_TEMP = 80; //What temp when no event is scheduled
const LONG_PATTERN =  Buffer.alloc(10,'584D5300036b00000166','hex'); //No button pressed pattern
const TEMP_UP =       Buffer.alloc(10,'584D5300036b00020168', 'hex'); //Temp up presses pattern
const TEMP_DOWN =     Buffer.alloc(10,'584D5300036b0008016e', 'hex'); //Temp down presssed pattern
const VIRTUAL_PRESS_DELAY = 40; //delay in ms between vitual button presses
const VIR_PRESS_PAT_REPEAT = 5; //How many pattern repeats for each virtual press 10 is too many, registers mutiple sometimes
const NUM_VIRT_PRESS_TO_LIMIT = 26; //How many virtual presses to hit a limit
const DELAY_DOWN_TO_UP = 60000; //How long to wait between the two temp changes
//Globals
let pendingCommands = null; //Mutex for pending unexecuted commands
let errorsInAPI = 0; //Counter to limit requests to Google

// Log file for testing purposes
const logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});
// Serial Port to send commands
const port = new SerialPort('/dev/serial0', {  baudRate: 115200 });

//Make sure at startup we don't control the serial bus
mux_off();
//If interrupted, turn mux off
process.on('SIGINT', _ => {
  MUXPin.writeSync(0);
  process.exit();
});

// logging function
function combinedLog(message) {
  let curDate = new Date();
  let dateStr = curDate.toString();
  message = dateStr.slice(0,dateStr.length-33) + ':' + curDate.getMilliseconds() + ': ' + message; //Prepend Time to message
  console.log(message);
  logfile.write(message + '\n')
}

// Load API Key from a local file.
fs.readFile(API_KEY_PATH, (err, content) => {
  if (err) return combinedLog('Error loading API key file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  const obj = JSON.parse(content);
  planEvents(obj.api_key, obj.google_cal_id); //Do a plan now
  setInterval(planEvents, UPDATE_INTERVAL*60000, obj.api_key,obj.google_cal_id); //Replan
  combinedLog('New Session');
});


function planEvents(api_key, google_cal_id) { //Plan out the current interval
  const calendar = google.calendar({version: 'v3', auth: api_key});
  const planStartDate = new Date;
  planStartDate.setSeconds(planStartDate.getSeconds() + 10); //Give us a ten sec delay for causality
  const planEndDate = new Date(planStartDate.getTime()); //Clone current time
  planEndDate.setMinutes(planStartDate.getMinutes() + UPDATE_INTERVAL + INTERVAL_OVERLAP); // Next interval
  if (pendingCommands) { //We have unexed commands, this happens
    combinedLog('We had pending events at: ' + pendingCommands.toString());
    let delay = Math.abs(pendingCommands - Date.now())+10;
    if (delay < UPDATE_INTERVAL * 60000 ) { //if the normal update wont get it
      setTimeout(planEvents,delay, api_key, google_cal_id); //Call ourself in the future
      combinedLog('Recall planEvents() in ' + delay + ' ms');
    }
    return; // don't plan
  }
  calendar.events.list({
    calendarId: google_cal_id,
    timeMin: planStartDate.toISOString(),
    timeMax: planEndDate.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      combinedLog('The Google API request returned an error: ' + err);
      errorsInAPI += 1;
      combinedLog('We have ' + errorsInAPI + ' running errors');
      if (errorsInAPI < 10) { //For now limit us to 10 extra requests
        setTimeout(planEvents,60000,api_key,google_cal_id); //Call ourself one min in the future
        combinedLog('Recall planEvents() in one min');
      }
      return; //don't plan
    }
    errorsInAPI = 0; //Reset error counter
    const events = res.data.items;
    //combinedLog('Got ' + events.length + ' events!' );
    for (let event of events) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      let summary = event.summary.split(":"); //Look for desired temp
      let desired_temp = parseInt(summary[1],10);
      if (summary.length == 2 && summary[0].trim() == 'Temp' &&
      Number.isInteger(desired_temp) && desired_temp > 79 && desired_temp < 105) { //Validate Summary
         //combinedLog('Got Valid Temp of: ' + desired_temp);
         if ( eventStart >= planStartDate ) { //If the event starts after interval start, need a temp up event
           //combinedLog('Temp Up to ' + desired_temp + ' Event Found at start: ' + eventStart.toString());
           scheduleTemp(desired_temp, eventStart); //Schedule the temp change
         }
         if ( eventEnd <= planEndDate ) { //If the event ends before the interval end, need a temp down event
           //combinedLog('Temp Down Event Found at end: ' + eventEnd.toString());
           scheduleTemp(IDLE_TEMP, eventEnd); //Schedule the temp change
         }
      }
      else { //If not valid, do nothing
        combinedLog('Malformed Event Summary: ' + event.summary)
      }
    }
  });
}

function scheduleTemp (temp,atTime) { //Set Temp from a limit, so we don't need to know what current temp setting is
  let msecsInFuture  = Math.abs(atTime - Date.now());
  if (temp >= 104) { //This is the limit, so just go there with extra presse
    tempCommand(NUM_VIRT_PRESS_TO_LIMIT,true,msecsInFuture,false); //Ensure we are at 104 by going up a bunch
    tempCommand(NUM_VIRT_PRESS_TO_LIMIT,true,msecsInFuture + DELAY_DOWN_TO_UP,true); //Double ensure
  }
  else {
    if (temp > 80) { //If above 80, go there after a delay
      tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture,false); //Ensure we are at 80 by going down a bunch
      tempCommand(temp-79,true,msecsInFuture + DELAY_DOWN_TO_UP,true); //Go up from 80 after delay, first press is lost
    }
    else {
      tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture,false); //Ensure we are at 80 by going down a bunch
      tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture + DELAY_DOWN_TO_UP,true); //Double Ensure
    }
  }
}

function tempCommand(numPress,isUp,commandDelay,endEvent) { //Schedule a series of vitual button presses
  let i = 1; //Virtual button presses Counter
  let x = 0; //Button press pattern repeat counter
  setTimeout(mux_on,commandDelay); // Take control of the serial bus
  //Cue up a bunch of virtual button presses between idle commands
  for (i = 1; i < numPress*VIR_PRESS_PAT_REPEAT*2; i+=VIR_PRESS_PAT_REPEAT*2) {
    for (x = 0; x < VIR_PRESS_PAT_REPEAT; x++) { //Each
      if (isUp) {
        setTimeout(sendUp,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay);
      }
      else {
        setTimeout(sendDown,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay);
      }
    } //Cue up a bunch of idle commands in between the button presses
    for (x = VIR_PRESS_PAT_REPEAT; x < VIR_PRESS_PAT_REPEAT*2; x++) {
      setTimeout(sendIdle,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay);
    }
  }
  let endMs = i*VIRTUAL_PRESS_DELAY+commandDelay;
  setTimeout(mux_off,endMs); //Give back control of the bus
  if (endEvent) { //if this is the final command, set the mutex and a delay to clear it
    pendingCommands = new Date(Date.now() + endMs);
    setTimeout(clear_commands,endMs); //clear the mutex when commands are done
  }
  //Below is to generate a log event after the event finishes
  setTimeout(combinedLog,endMs,'Finished Exec ' + numPress + ' presses ' + isUp);
}
//Convience functions allowing for logging and avoid passing args with setTimeout
function clear_commands() {
  pendingCommands = null;
}

function mux_on() {
  //combinedLog('MUX ON');
	MUXPin.writeSync(1);
}

function mux_off() {
  //combinedLog('MUX OFF');
	MUXPin.writeSync(0);
}

function sendDown() {
  //combinedLog('SEND TEMP DOWN');
	port.write(TEMP_DOWN);
}

function sendUp() {
  //combinedLog('SEND TEMP UP');
	port.write(TEMP_UP);
}

function sendIdle() {
  //combinedLog('SEND IDLE PAT');
	port.write(LONG_PATTERN);
}
