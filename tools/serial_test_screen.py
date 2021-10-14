#!/usr/bin/env python3
import datetime
import serial

ser = serial.Serial(
    port='/dev/serial0',
    baudrate = 115200,
#    parity=serial.PARITY_NONE,
#    stopbits=serial.STOPBITS_ONE,#35B (minus 6 bits) with two stop bits
#    bytesize=serial.EIGHTBITS,  # 38 bytes with one stop bit
    #timeout=0.05,
    )
old=ser.read(10)
#old_bin_string = bin(int(old.hex(),16))
print(old.hex())
while True:
    data=ser.read(10)
    if (data != old):
        #bin_string = bin(int(data.hex(),16))
        print(data.hex())
        old = data
