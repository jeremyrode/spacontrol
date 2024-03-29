#!/usr/bin/env python3
import datetime
import serial

ser = serial.Serial(
    port='/dev/ttyAMA0',
    baudrate = 115200,
    timeout=0  #Attempting to time gate the pattern
#   parity=serial.PARITY_NONE,
#   stopbits=serial.STOPBITS_TWO,#35B (minus 6 bits) with two stop bits
#   bytesize=serial.EIGHTBITS,  # 38 bytes with one stop bit

    )

len = 100
blank_run = 0

while True:
    data=ser.read(len)
    if (data): #Don't print empty lines
        if (blank_run):
            print('Run of ' + "{0:5d}".format(blank_run) + ' blanks')
            blank_run = 0
        bin_string = data.hex()
        print(bin_string)
    else:
        blank_run += 1
    #    old = data


#if (data != old):
