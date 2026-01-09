@echo off
chcp 65001
SETLOCAL ENABLEDELAYEDEXPANSION

for /f "delims=" %%f IN ('dir /b /s "YOUR_DISK:\Path\To\Your Music\That May contain Spaces\*.wav"') do (
set file1=%%~nf.mp3
echo "file :" !file1!
set fic1=%%f
echo "file : " !fic1!

CALL "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"  "!fic1!" --sout="#transcode{vcodec=none,acodec=mp3,ab=320,channels=2,samplerate=48000}:std{access=file{no-overwrite},mux=mp3,dst="""!file1!"""}" vlc://quit
)

echo .
echo conversion finished
pause