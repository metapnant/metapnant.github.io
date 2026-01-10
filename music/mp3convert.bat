@echo off
title WAV to MP3 Optimizer
if not exist "mp3_optimized" mkdir "mp3_optimized"

echo Starting conversion...
echo ---------------------------------------

for %%f in (*.wav) do (
    echo Processing: "%%f"
    ffmpeg -i "%%f" -codec:a libmp3lame -b:a 320k -map_metadata 0 -id3v2_version 3 "mp3_optimized\%%~nf.mp3" -y
)

echo ---------------------------------------
echo Done! Files are in the "mp3_optimized" folder.
pause