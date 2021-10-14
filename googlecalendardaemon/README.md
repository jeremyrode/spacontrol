# Spacontrol via Google calendar
## Status
Currently in active development.  Tested for about a week.  After 4 days the Google API code started to return:
```
Error: invalid_grant
```
Debugging is going to take a while, as the issue takes days to manifest.  I cleaned up my code to closely match the example from Google.

Turns out this is not a code problem, it is because my refresh token from Google was issued under a testing app.  From the Google documentation:
```
A Google Cloud Platform project with an OAuth consent screen configured for an external user type and a publishing
status of "Testing" is issued a refresh token expiring in 7 days.
```
I have switched my app to "In production".  I don't plan on verifying the App.  It is unclear what the refresh token expiry will be for an in production app that is unverified.  Currently regenerated the refresh token, and will see if it expires.  I will probably abandon the Google API route if I need to reauthorize the app every 7 days.

## Details
Code polls a specified Google calendar, looks for events with 'Temp:'.  If these events are found, create the correct sequence of injected virtual button presses to achieve the desired temperature, no matter what the current setting is.

I plan to eventually incorporate circulation into the code, but first I need to get the current state from the screen.  Unlike the temperature where a known state can be achieved by hitting the limit, the jets button cycles through the states.  Without a method of determining the current state, there is no way to get the system reliably into a given state.

I don't plan on automating the OAuth or Calendar selection, so use listCals to generate a Google API key, and to get the Calendar ID and paste into code.

Default is 80 deg for all time except if there is no event.
