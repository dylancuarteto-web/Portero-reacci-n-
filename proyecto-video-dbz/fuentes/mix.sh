cd /tmp/claude-0/-home-user-Portero-reacci-n-/a355c1f4-5b7d-5a47-acf1-051f08711812/scratchpad/out/wav
ffmpeg -v error -y -i music_loop.wav -i /tmp/claude-0/-home-user-Portero-reacci-n-/a355c1f4-5b7d-5a47-acf1-051f08711812/scratchpad/a/narr.wav -i sfx.wav -filter_complex "
[1:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=44100,asplit=2[v][k];
[0:a]highpass=f=70,lowpass=f=11000,afftdn=nr=12:nf=-48,loudnorm=I=-28:TP=-3:LRA=7,aresample=44100,afade=t=in:d=1.5,afade=t=out:st=69.5:d=3.9[mu];
[mu][k]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=500:makeup=1[md];
[2:a]alimiter=limit=0.7[fx];
[v][md][fx]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.89:level=0,aresample=48000,apad=whole_dur=73.404,atrim=0:73.404[o]" -map "[o]" -ac 2 mix.wav
