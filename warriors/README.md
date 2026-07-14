# The Squad — warrior portraits

Drop AI-generated warrior images here and they appear on the dashboard's
"The Squad" wall automatically (within ~1 hour, the cache window). **No code
changes, no redeploy.**

## How to add a warrior
1. Generate a **1024×1024 square** portrait (ChatGPT / Midjourney / Gemini / Canva).
   Keep a consistent style across all of them so the wall looks like a set —
   e.g. *"epic fantasy warrior portrait, [person], dramatic lighting, dark moody
   background, digital art, centered, square."*
2. Name the file after the person: `waqar_ahmed.png`, `adrees_khan.png`
   (underscores/dashes become spaces, auto-capitalized → "Waqar Ahmed").
3. Upload it to this `warriors/` folder — easiest via GitHub's web UI:
   open the folder on github.com → **Add file → Upload files** → drag → commit.
   That's it. No git commands needed.

Supported: `.png .jpg .jpeg .webp .gif`. Keep files under ~2MB (compress big
PNGs at tinypng.com if needed) so the page stays fast.

## Optional: names & titles (warriors.json)
To give a warrior a custom display name or a gamer-title, add an entry to
`warriors.json` in this folder. Without it, the filename is used as the name and
there's no title. Example:

```json
[
  { "file": "waqar_ahmed.png", "name": "Waqar Ahmed", "title": "The Warlord" },
  { "file": "adrees_khan.png", "name": "Adrees Khan", "title": "The Ghost" }
]
```

The current recommended host gets a gold 🏆 glow on their card automatically —
match works by name, so the name here should match their GameNight display name.
