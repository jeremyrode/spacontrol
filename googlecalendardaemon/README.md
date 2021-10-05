# Spacontrol via Google calendar
## Status
Currently in active development.  Tested for about a week.  After 4 days the Google API code started to return:
```
Error: invalid_grant
```
Debugging is going to take a while, as the issue takes days to manifest.  I cleaned up my code to closely match the example from Google.

## Details
Code polls a specified Google calendar, looks for events with 'Temp:'.  If these events are found, create the correct sequence of injected virtual button presses to achieve the desired temperature, no matter what the current setting is.

I plan to eventually incorporate circulation into the code, but first I need to get the current state from the screen.  Unlike the temperature where a known state can be achieved by hitting the limit, the jets button cycles through the states.  Without a method of determining the current state, there is no way to get the system reliably into a given state.

I don't plan on automating the OAuth or Calendar selection, so use listCals to generate a Google API key, and to get the Calendar ID and paste into code.

Default is 80 deg for all time except if there is no event.
