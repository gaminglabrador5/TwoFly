TwoFly
======

Freeware dispatch desk for Microsoft Flight Simulator 2024.
Also usable as a planning sheet for other sims.

Installation
------------
1. Download TwoFly.
2. Extract the ZIP.
3. Run TwoFly.exe.
4. Create your pilot.
5. Fly.

No installer. No Community folder.
Windows 10 / 11, 64-bit.
Uses the Microsoft Edge WebView2 Runtime (already on most Windows 10/11 PCs).
If TwoFly asks for it: https://go.microsoft.com/fwlink/p/?LinkId=2124703

Optional Sim Watch (off by default) can read MSFS while you fly: crash,
steep bank, and landing time. No map. SimConnect.dll is included in this
zip — keep it next to TwoFly.exe. Start MSFS, load a cockpit, then Watch.

Windows SmartScreen
-------------------
Unsigned portable programs often show "Windows protected your PC".
Click More info, then Run anyway. This is expected. TwoFly is not
code-signed. Defender is not reporting a virus; it is blocking an
unknown new executable.

Use
---
FREE FLIGHT — fly any type. Pay only.
CAREER MODE — hangar fleet. Pay and XP. Certificates
(Student Pilot → Private Pilot → Commercial Pilot → ATP).

1. Pick departure and aircraft.
2. Issue taskings (1 / 3 / 5).
3. Accept, fly in the sim, then Complete or Abort.

Progress
--------
Pilot name, photo, hangar, money, XP, log, and collectables save on
this machine (Windows: %LOCALAPPDATA%\TwoFly). Replacing TwoFly.exe
does not erase the pilot file.

Settings → Export Backup saves a .json copy you can keep off-machine.
Import Backup restores it.

If the window is blank, close TwoFly, then delete the folder
%LOCALAPPDATA%\TwoFly\wv2 and run TwoFly.exe again.

Optional art next to TwoFly.exe
-------------------------------
  stamps/landmarks/<id>.jpg
  stamps/cities/<id>.jpg        800x600
  stamps/airports/<ICAO>.jpg    800x600
  pilots/1.jpg … 16.jpg

JPEG first; PNG is accepted as a fallback.

MIT License — free to use, copy, and share. See LICENSE.
Copyright (c) 2026 gaminglabrador5
Designed and directed by gaminglabrador5.
Software implementation with Grok (xAI).

Airfield data: OurAirports (public domain).
IBM Plex fonts: SIL Open Font License 1.1.
Not affiliated with Microsoft, Asobo, or any payware studio.

TwoFly v1.7.3
