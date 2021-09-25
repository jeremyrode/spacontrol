#!/usr/bin/node

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
//const SerialPort = require('serialport'); //UNCOMMENT FOR REAL OPERATION
//const Delimiter = require('@serialport/parser-delimiter'); //UNCOMMENT FOR REAL OPERATION
//const Gpio = require('onoff').Gpio; //require onoff to control GPIO UNCOMMENT FOR REAL OPERATION
//const MUXPin = new Gpio(5, 'out'); //declare GPIO5, the muxpin as an output UNCOMMENT FOR REAL OPERATION

process.title = 'GoogleCalendarDaemon';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '/home/pi/token.json';
const SECRET_PATH = '/home/pi/client_secret.json';
const LOG_FILE = '/home/pi/SpaCalendarLog.txt';
const GOOGLE_CAL_ID = '86tvif05v2c7t148ctpojefc8k@group.calendar.google.com';
const UPDATE_INTERVAL = 20; //How often to poll Goolge canlendar In mins
const INTERVAL_OVERLAP = 1; //In mins to be sure we don't miss anything
const IDLE_TEMP = 80; //What temp when no event is scheduled
const LONG_PATTERN =  Buffer.alloc(10,'584D5300036b00000166','hex'); //No button pressed pattern
const TEMP_UP =       Buffer.alloc(10,'584D5300036b00020168', 'hex'); //Temp up presses pattern
const TEMP_DOWN =     Buffer.alloc(10,'584D5300036b0008016e', 'hex'); //Temp down presssed pattern
const VIRTUAL_PRESS_DELAY = 40; //delay in ms between vitual button presses
const VIR_PRESS_PAT_REPEAT = 5; //How many pattern repeats for each virtual press 10 is too many, registers mutiple sometimes
const NUM_VIRT_PRESS_TO_LIMIT = 26; //How many virtual presses to hit a limit
const DELAY_DOWN_TO_UP = 60000; //How long to wait between the two temp changes

var oAuth2Client; //The Auth for calendars
var curPlanCommands = new Array(); //List of Intervals for the curent plan

// Log file for testing purposes
var logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});
function combinedLog(message) {
  let curDate = new Date();
  let dateStr = curDate.toString();
  message = dateStr.slice(0,dateStr.length-33) + ':' + curDate.getMilliseconds() + ': ' + message; //Prepend Time to message
  console.log(message);
  logfile.write(message + '\n')
}
//Make sure at startup we don't control the serial bus
mux_off(); //UNCOMMENT FOR REAL OPERATION
// Load client secrets from a local file.
fs.readFile(SECRET_PATH, (err, content) => {
  if (err) {
    combinedLog('Error loading client secret file');
    return console.log('Error loading client secret file:', err);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content),listEvents);
  setInterval(() => {listEvents(oAuth2Client)}, UPDATE_INTERVAL*60000); //Reupdate, do we need to reauth?
});

//const port = new SerialPort('/dev/serial0', { //UNCOMMENT FOR REAL OPERATION
//  baudRate: 115200 //UNCOMMENT FOR REAL OPERATION
//}) //UNCOMMENT FOR REAL OPERATION
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      combinedLog('Error loading OAuth Token');
      return console.log('Error loading OAuth Token:', err);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  const curHour = new Date; //Plan out the current hour
  curHour.setSeconds(curHour.getSeconds() + 10); //Give us a ten sec delay for causality
  const nextHour = new Date(curHour.getTime()); //Clone current time
  nextHour.setMinutes(curHour.getMinutes() + UPDATE_INTERVAL + INTERVAL_OVERLAP); // Next interval
  //combinedLog('We are planning');
  //combinedLog('From: ' + curHour.toString());
  //combinedLog('To: ' +  nextHour.toString());
  mux_off(); //On the small chance we interrupt a command
  while (curPlanCommands.length) { //flush the current plan in
    clearTimeout(curPlanCommands.pop());
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
    }
    const events = res.data.items;
    //combinedLog('Got ' + events.length + ' events!' );
    for (let event of events) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      var summary = event.summary.split(":"); //Look for desired temp
      var desired_temp = parseInt(summary[1],10);
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
    //combinedLog('Scheduling an up to 104 in ' + (msecsInFuture/60000).toFixed(1)  + ' minutes');
    tempCommand(NUM_VIRT_PRESS_TO_LIMIT,true,msecsInFuture); //Ensure we are at 104 by going up a bunch
  }
  else {
    //combinedLog('Scheduling a go down to 80 in ' + (msecsInFuture/60000).toFixed(1)  + ' minutes');
    tempCommand(NUM_VIRT_PRESS_TO_LIMIT,false,msecsInFuture); //Ensure we are at 80 by going down a bunch
    if (temp > 80) { //If above 80, go there after a delay
      //combinedLog('Scheduling ' + (temp-79).toFixed(1) + ' virtual presses in ' + ((msecsInFuture + DELAY_DOWN_TO_UP)/60000).toFixed(1)  + ' minutes');
      tempCommand(temp-79,true,msecsInFuture + DELAY_DOWN_TO_UP); //Go up from 80 after delay, first press is lost
    }
  }
}

function tempCommand(numPress,isUp,commandDelay) { //Schedule a series of vitual button presses
  let i = 1; // Push all the timeout events, so we can ensure they're cancelled
  let x = 0; // when we plan the next interval
  curPlanCommands.push(setTimeout(mux_on,commandDelay)); // Take control of the serial bus
  //Cue up a bunch of virtual button presses between idle commands
  for (i = 1; i < numPress*VIR_PRESS_PAT_REPEAT*2; i+=VIR_PRESS_PAT_REPEAT*2) {
    for (x = 0; x < VIR_PRESS_PAT_REPEAT; x++) {
      if (isUp) {
        curPlanCommands.push(setTimeout(sendUp,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay));
      }
      else {
        curPlanCommands.push(setTimeout(sendDown,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay));
      }
    }
    for (x = VIR_PRESS_PAT_REPEAT; x < VIR_PRESS_PAT_REPEAT*2; x++) {
      curPlanCommands.push(setTimeout(sendIdle,(i+x)*VIRTUAL_PRESS_DELAY+commandDelay));
    }
  }
  curPlanCommands.push(setTimeout(mux_off,i*VIRTUAL_PRESS_DELAY+commandDelay)); //Give back control of the bus
  curPlanCommands.push(setTimeout(combinedLog,i*VIRTUAL_PRESS_DELAY+commandDelay,
    'Finished Exec ' + numPress + ' presses ' + isUp)); // Log an event for testing
}

function mux_on() {
  //combinedLog('MUX ON');
	//MUXPin.writeSync(1); //UNCOMMENT FOR REAL OPERATION
}

function mux_off() {
  //combinedLog('MUX OFF');
	//MUXPin.writeSync(0); //UNCOMMENT FOR REAL OPERATION
}

function sendDown() {
  //combinedLog('SEND TEMP DOWN');
	//port.write(TEMP_DOWN); //UNCOMMENT FOR REAL OPERATION
}

function sendUp() {
  //combinedLog('SEND TEMP UP');
	//port.write(TEMP_UP); //UNCOMMENT FOR REAL OPERATION
}

function sendIdle() {
  //combinedLog('SEND IDLE PAT');
	//port.write(LONG_PATTERN); //UNCOMMENT FOR REAL OPERATION
}
