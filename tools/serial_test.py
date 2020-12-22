#!/usr/bin/env python3
import datetime
import serial

ser = serial.Serial(
    port='/dev/ttyAMA0',
    baudrate = 115200,
    timeout=0.05  #Attempting to time gate the pattern
#   parity=serial.PARITY_NONE,
#   stopbits=serial.STOPBITS_TWO,#35B (minus 6 bits) with two stop bits
#   bytesize=serial.EIGHTBITS,  # 38 bytes with one stop bit

    )

len = 128

while True:
    data=ser.read(len)
    if (data): #Don't print empty lines
        bin_string = data.hex()
        print(bin_string)
        old = data


#if (data != old):
