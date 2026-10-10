# ECDICT

Source: https://github.com/skywind3000/ECDICT

Pinned revision: `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`.
MIT license is retained in `public/ecdict/LICENSE.txt`.
761,816 English words/phrases with definitions are bundled from the upstream full CSV.
Only the English query domain supported by this app is included (letters, spaces,
apostrophes and hyphens, up to 80 characters). Chinese definitions are converted at
build time with OpenCC 1.4.2, s2twp (Taiwan Traditional Chinese and phrases).
English headwords and phonetics are unchanged; no invented examples or audio.
Speech uses the existing device TTS. Existing saved user cards are not rewritten.
OpenCC's Apache-2.0 license and modification notice are retained in
`public/ecdict/OpenCC-LICENSE.txt` and `public/ecdict/NOTICE.txt`.

Browser searches fetch one same-origin static shard (256 buckets), not a third-party
API. Auto mode tries ECDICT before online dictionaries for English; Chinese reverse
lookup still uses Google. Missing words explicitly report no match when ECDICT is selected.
Visited shards are cached by the service worker; first-time queries need connectivity.
The entire dictionary is not downloaded during PWA installation.

Install the build-only converter with `pip install --index-url https://pypi.org/simple OpenCC==1.4.2`.
Rebuild with Python 3: `python scripts/build-ecdict.py`.
Optional Android assets target: `python scripts/build-ecdict.py ../app/src/main/assets`.
Manifest records revision, upstream CSV SHA-256 and entry count. No API key required.
