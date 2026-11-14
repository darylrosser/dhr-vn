#!/bin/sh
# Makes the small shelf covers for /reading/: public/reading/covers/<isbn>.jpg ->
# covers/thumbs/<isbn>.webp, 360px wide (sharp on retina phones), ~25 KB each.
# Only builds the missing ones; pass --all to rebuild every thumbnail.
# Needs ImageMagick (brew install imagemagick).
set -e
cd "$(dirname "$0")/../public/reading/covers"
mkdir -p thumbs
for f in *.jpg; do
  out="thumbs/${f%.jpg}.webp"
  if [ "$1" = "--all" ] || [ ! -f "$out" ]; then
    magick "$f" -strip -resize '360x>' -quality 74 "$out"
    echo "made $out"
  fi
done
