const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

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
const UPDATE_INTERVAL = 1; //In mins
const INTERVAL_OVERLAP = 1; //In mins
const IDLE_TEMP = 80;

var oAuth2Client; //The Auth for calendars
var curPlanCommands = new Array(); //List of Intervals for the curent interval

// Log file for testing purposes
var logfile = fs.createWriteStream(LOG_FILE, {flags:'a'});
function combinedLog(message) {
  message = (new Date()).toString() + ': ' + message; //Prepend Time to message
  console.log(message);
  logfile.write(message + '\n')
}

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
  combinedLog('Event Handler Called');
  const nextHour = new Date(curHour.getTime()); //Clone current time
  nextHour.setMinutes(curHour.getMinutes() + UPDATE_INTERVAL + INTERVAL_OVERLAP); // Next interval
  combinedLog('We are planning');
  combinedLog('From: ' + curHour.toString());
  combinedLog('To: ' +  nextHour.toString());
  while (curPlanCommands.length) { //flush the current plan
    clearTimeout(curPlanCommands.pop());
    combinedLog('Cleared a Timeout!')
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
    combinedLog('Got ' + events.length + ' events!' );
    for (let event of events) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      if ( eventStart >= curHour ) { //If the event starts after interval start, need a temp up event
        combinedLog('Temp Up Event Found at start: ' + eventStart.toString());
        var summary = event.summary.split(":"); //Look for desired temp
        if (summary.length == 2 && summary[0].trim() == 'Temp') {
           var desired_temp = parseInt(summary[1]);
           combinedLog('Got Valid Temp of: ' + desired_temp);
        }
        else {
          combinedLog('Malformed Summary: ' + event.summary)
        }
        curPlanCommands.push(setTimeout(setTemp, Math.abs(eventStart - Date.now()), desired_temp)); //Schedule the temp change
      }
      if ( eventEnd <= nextHour ) { //If the event ends before the interval end, need a temp down event
        combinedLog('Temp Down Event Found at end: ' + eventEnd.toString());
        curPlanCommands.push(setTimeout(setTemp, Math.abs(eventEnd - Date.now()), IDLE_TEMP)); //Schedule the temp change
      }
    }
  });
}

function setTemp (temp) {
  combinedLog('Setting Temp to ' + temp + ' deg');
}
