"""Rebuild bundled ECDICT shards from a pinned MIT-licensed upstream snapshot.
Usage: python scripts/build-ecdict.py [Android assets directory]
Generated data is deliberately not executable code. No credentials required.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request

REVISION = "bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b"
BASE = f"https://raw.githubusercontent.com/skywind3000/ECDICT/{REVISION}/"

def shard(word):
    value = 2166136261
    for char in word:
        value = ((value ^ ord(char)) * 16777619) & 0xffffffff
    return f"{value & 255:02x}"

def main():
    with urllib.request.urlopen(BASE + "ecdict.csv", timeout=120) as response:
        raw = response.read(80_000_000)
    if hashlib.sha256(raw).hexdigest() != "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf":
        raise ValueError("ECDICT source checksum mismatch; refusing to replace bundled data")
    with urllib.request.urlopen(BASE + "LICENSE", timeout=30) as response:
        license_text = response.read().decode("utf-8")
    buckets = {f"{index:02x}": {} for index in range(256)}
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        word = row["word"].strip()
        key = word.lower()
        # Same validated English word/phrase domain supported by both search UIs.
        if not key or len(key) > 80 or any(c not in "abcdefghijklmnopqrstuvwxyz '-" for c in key):
            continue
        definition = row["translation"].strip() or row["definition"].strip()
        if not definition:
            continue
        clean = lambda value: value.replace("\\n", "\n").strip()
        entry = [word, clean(row["phonetic"]), clean(row["pos"]), clean(definition)]
        buckets[shard(key)].setdefault(key, entry)
    targets = [Path(__file__).resolve().parents[1] / "public" / "ecdict"]
    if len(sys.argv) > 1:
        targets.append(Path(sys.argv[1]).resolve() / "ecdict")
    count = sum(len(bucket) for bucket in buckets.values())
    manifest = {"source": "https://github.com/skywind3000/ECDICT", "revision": REVISION,
                "csvSha256": hashlib.sha256(raw).hexdigest(), "entries": count,
                "license": "MIT", "translation": "upstream Chinese (mostly simplified)",
                "format": "FNV-1a low byte; [word, phonetic, pos, definition]; English exact match"}
    for target in targets:
        target.mkdir(parents=True, exist_ok=True)
        for name, bucket in buckets.items():
            (target / f"{name}.json").write_text(json.dumps(bucket, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (target / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (target / "LICENSE.txt").write_text(license_text, encoding="utf-8")
    print(f"Generated {count} ECDICT entries across 256 shards for {len(targets)} projects.")

if __name__ == "__main__":
    main()
