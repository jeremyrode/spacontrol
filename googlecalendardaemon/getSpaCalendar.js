#!/usr/bin/node

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');
const Gpio = require('onoff').Gpio; //require onoff to control GPIO
const MUXPin = new Gpio(5, 'out'); //declare GPIO5, the muxpin as an output

process.title = 'GoogleCalendarDaemon';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = '/home/pi/token.json';
const SECRET_PATH = '/home/pi/client_secret.json';
const LOG_FILE = '/home/pi/SpaCalendarLog.txt';
const GOOGLE_CAL_ID = '86tvif05v2c7t148ctpojefc8k@group.calendar.google.com';
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

let pendingCommands = false; //Mutex for pending unexecuted commands

// Log file for testing purposes
let logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});

//Make sure at startup we don't control the serial bus
mux_off();

// logging function
function combinedLog(message) {
  let curDate = new Date();
  let dateStr = curDate.toString();
  message = dateStr.slice(0,dateStr.length-33) + ':' + curDate.getMilliseconds() + ': ' + message; //Prepend Time to message
  console.log(message);
  logfile.write(message + '\n')
}

function main(oAuth2Client) { //What to do after authentication
  planEvents(oAuth2Client); //Do a plan now
  setInterval(planEvents, UPDATE_INTERVAL*60000, oAuth2Client); //Replan
}

// Load client secrets from a local file.
fs.readFile(SECRET_PATH, (err, clientSecret) => {
  if (err) {
    combinedLog('Error loading client secret file');
    return console.log('Error loading client secret file:', err);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(clientSecret), main);
});

  // Authorize a client with credentials, then call the Google Calendar API
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      combinedLog('Error loading OAuth Token');
      return console.log('Error loading OAuth Token:', err);
    }
    let parsedToken = JSON.parse(token);
    oAuth2Client.setCredentials(parsedToken);
    callback(oAuth2Client);
  });
}

const port = new SerialPort('/dev/serial0', {
  baudRate: 115200
})

function planEvents(auth) { //Plan out the current interval
  const calendar = google.calendar({version: 'v3', auth});
  const curHour = new Date;
  curHour.setSeconds(curHour.getSeconds() + 10); //Give us a ten sec delay for causality
  const nextHour = new Date(curHour.getTime()); //Clone current time
  nextHour.setMinutes(curHour.getMinutes() + UPDATE_INTERVAL + INTERVAL_OVERLAP); // Next interval
  if (pendingCommands) { //We have unexed commands, this is unlikely
    combinedLog('We had pending events at: ' + pendingCommands.toString());
    let delay = Math.abs(pendingCommands - Date.now())+10;
    if (delay < UPDATE_INTERVAL * 60000 ) { //if the normal update wont get it
      setTimeout(planEvents,delay,auth); //Call ourself in the future
      combinedLog('Recall planEvents() in ' + delay + ' ms');
    }
    return; // don't plan
  }
  calendar.events.list({
    calendarId: GOOGLE_CAL_ID,
    timeMin: curHour.toISOString(),
    timeMax: nextHour.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      combinedLog('The API returned an error: ' + err);
      return;
    }
    const events = res.data.items;
    combinedLog('Got ' + events.length + ' events!' );
    for (let event of events) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      let summary = event.summary.split(":"); //Look for desired temp
      let desired_temp = parseInt(summary[1],10);
      if (summary.length == 2 && summary[0].trim() == 'Temp' &&
      Number.isInteger(desired_temp) && desired_temp > 79 && desired_temp < 105) { //Validate Summary
         //combinedLog('Got Valid Temp of: ' + desired_temp);
         if ( eventStart >= curHour ) { //If the event starts after interval start, need a temp up event
           //combinedLog('Temp Up to ' + desired_temp + ' Event Found at start: ' + eventStart.toString());
           scheduleTemp(desired_temp, eventStart); //Schedule the temp change
         }
         if ( eventEnd <= nextHour ) { //If the event ends before the interval end, need a temp down event
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
    tempCommand(NUM_VIRT_PRESS_TO_LIMIT,true,msecsInFuture,true); //Ensure we are at 104 by going up a bunch
  }
  else {
    if (temp > 80) { //If above 80, go there after a delay
      tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture,false); //Ensure we are at 80 by going down a bunch
      tempCommand(temp-79,true,msecsInFuture + DELAY_DOWN_TO_UP,true); //Go up from 80 after delay, first press is lost
    }
    else {
      tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture,true); //Ensure we are at 80 by going down a bunch
    }
  }
}

function tempCommand(numPress,isUp,commandDelay,endEvent) { //Schedule a series of vitual button presses
  let i = 1; //Virtual button presses Counter
  let x = 0; //Button press pattern repeat counter
  setTimeout(mux_on,commandDelay); // Take control of the serial bus
  //Cue up a bunch of virtual button presses between idle commands
  for (i = 1; i < numPress*VIR_PRESS_PAT_REPEAT*2; i+=VIR_PRESS_PAT_REPEAT*2) {
    for (x = 0; x < VIR_PRESS_PAT_REPEAT; x++) {
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
    pendingCommands = new Date(Date.now() + endMs + 1);
    setTimeout(clear_commands,endMs + 1); //clear the mutex when done
  }
  //Below is to generate a log event after the event finishes
  setTimeout(combinedLog,endMs,'Finished Exec ' + numPress + ' presses ' + isUp);
}
//Convience functions allowing for logging and avoid passing args with setTimeout
function clear_commands() {
  pendingCommands = false;
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
