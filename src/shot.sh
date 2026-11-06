#!/bin/bash
# usage: shot.sh [slug...]  -> renders/<name>.png via headless Chrome
cd "$(dirname "$0")/../renders"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in ${@:-*.svg}; do
  f=${f%.svg}.svg
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1760,1040 --screenshot="${f%.svg}.png" "file://$PWD/$f" >/dev/null 2>&1
done
