#!/usr/bin/env python3
import datetime
import serial

ser = serial.Serial(
    port='/dev/ttyUSB0',
    baudrate = 115200,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_TWO,#35B (minus 6 bits) with two stop bits 
    bytesize=serial.EIGHTBITS,  # 38 bytes with one stop bit
   # timeout=1
    )
old=ser.read(8)
old_bin_string = old.hex()
print(old_bin_string)
while True:
    data=ser.read(8)
    if (data != old):
        bin_string = data.hex()
        print(bin_string)
        old = data
