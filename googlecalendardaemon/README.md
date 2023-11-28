# Spacontrol via Google calendar
## Status
Working for a year now!

## Details
Code polls a specified Google calendar, looks for events with 'Temp:'.  If these events are found, create the correct sequence of injected virtual button presses to achieve the desired temperature, no matter what the current setting is.

I plan to eventually incorporate circulation into the code, but first I need to get the current state from the screen.  Unlike the temperature where a known state can be achieved by hitting the limit, the jets button cycles through the states.  Without a method of determining the current state, there is no way to get the system reliably into a given state.

Default is 80 deg for all time except if there is no event.

## OAuth Drama

Google made getting a refresh token much harder (needing a publically avalible domain), so I switched this to a API key access method.  This is much easier, but has the side effect of only being able to access publically avalible calendars.  I see no need to keep my electric schedule private, so I make my spa control calendar public.
