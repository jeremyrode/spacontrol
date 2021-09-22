const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '/home/pi/token.json';
const SECRET_PATH = '/home/pi/client_secret.json';
var oAuth2Client;


// Load client secrets from a local file.
fs.readFile(SECRET_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content));
});

setInterval(() => {listEvents(oAuth2Client)}, 5000);
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 */
function authorize(credentials) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return console.log('Error loading OAuth Token:', err);
    oAuth2Client.setCredentials(JSON.parse(token));
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: '86tvif05v2c7t148ctpojefc8k@group.calendar.google.com',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Upcoming 10 events at ' + (new Date()).toISOString());
      events.map((event, i) => {
        console.log(event.start.date); //This is for all day events, lets ignore
        console.log(event.start.dateTime);
        console.log(event.summary);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}
