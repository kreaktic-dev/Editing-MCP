#!/usr/bin/env bash
# Full render in chunks (resumable: finished chunks are kept), then concat + mux with the sound.
# usage: bash scripts/render.sh [scale=1] [concurrency=2]   (scale 1.3333 = 1440x2560 final)
set -e
SCALE=${1:-1}; CONC=${2:-2}; CH=150
CHROME=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell}
TOTAL=$(npx tsx -e 'import {TOTAL} from "./src/videos/pisa/story"; console.log(TOTAL)')
D=out/pisa/chunks_$SCALE; mkdir -p $D
for ((a=0; a<TOTAL; a+=CH)); do
  b=$((a+CH-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=$D/c_$(printf %05d $a).mp4
  [ -s $f ] && continue
  echo "chunk $a-$b $(date +%T)"
  npx remotion render src/index.ts PisaShort $f.tmp.mp4 --frames=$a-$b --codec h264 --crf 16 --scale $SCALE --concurrency $CONC \
    --timeout 600000 --gl=swangle --browser-executable=$CHROME --log=error --muted 2>&1 | grep -iv "404\|warning\|memory\|docker\|cgroup\|meminfo\|lower amount" || true
  mv $f.tmp.mp4 $f
done
ls $D/c_*.mp4 | sed 's/^/file /;s/file /file ..\/..\/..\//' > $D/list.txt
(cd $D && ls c_*.mp4 | sed "s/^/file '/;s/$/'/" > list.txt && ffmpeg -y -v error -f concat -safe 0 -i list.txt -c copy ../video_$SCALE.mp4)
echo "done video_$SCALE.mp4 $(date +%T)"
