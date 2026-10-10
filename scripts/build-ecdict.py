"""Rebuild bundled ECDICT shards from a pinned MIT-licensed upstream snapshot.
Usage: python scripts/build-ecdict.py [Android assets directory] [--convert-existing]
Generated data is deliberately not executable code. No credentials required.
"""
import csv
import argparse
from importlib.metadata import distribution, version
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from opencc import OpenCC

REVISION = "bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b"
BASE = f"https://raw.githubusercontent.com/skywind3000/ECDICT/{REVISION}/"
CSV_SHA256 = "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf"
DATA_VERSION = "zh-TW-v1"
OPENCC_VERSION = "1.4.2"
CONVERSION = "s2twp"

def shard(word):
    value = 2166136261
    for char in word:
        value = ((value ^ ord(char)) * 16777619) & 0xffffffff
    return f"{value & 255:02x}"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("android_assets", nargs="?")
    parser.add_argument("--convert-existing", action="store_true", help="Convert the verified bundled shards instead of downloading the CSV")
    args = parser.parse_args()
    if version("OpenCC") != OPENCC_VERSION:
        raise ValueError(f"Install OpenCC=={OPENCC_VERSION} before rebuilding this dataset")
    converter = OpenCC(CONVERSION)
    source = Path(__file__).resolve().parents[1] / "public" / "ecdict"
    buckets = {f"{index:02x}": {} for index in range(256)}
    if args.convert_existing:
        previous = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
        if previous["revision"] != REVISION or previous["csvSha256"] != CSV_SHA256:
            raise ValueError("Bundled ECDICT provenance mismatch")
        if previous.get("translation") == "zh-TW":
            raise ValueError("Bundled data is already converted; rebuild from the pinned CSV instead")
        license_text = (source / "LICENSE.txt").read_text(encoding="utf-8")
        for name in buckets:
            data = json.loads((source / f"{name}.json").read_text(encoding="utf-8"))
            for key, entry in data.items():
                if len(entry) != 4 or not all(isinstance(value, str) for value in entry) or shard(key) != name:
                    raise ValueError("Malformed ECDICT shard")
                # Preserve English headwords, IPA and the separate example fields.
                buckets[name][key] = [entry[0], entry[1], converter.convert(entry[2]), converter.convert(entry[3])]
        if sum(len(bucket) for bucket in buckets.values()) != previous["entries"]:
            raise ValueError("ECDICT entry count changed")
    else:
        with urllib.request.urlopen(BASE + "ecdict.csv", timeout=120) as response:
            raw = response.read(80_000_000)
        if hashlib.sha256(raw).hexdigest() != CSV_SHA256:
            raise ValueError("ECDICT source checksum mismatch; refusing to replace bundled data")
        with urllib.request.urlopen(BASE + "LICENSE", timeout=30) as response:
            license_text = response.read().decode("utf-8")
        for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
            word = row["word"].strip()
            key = word.lower()
            if not key or len(key) > 80 or any(c not in "abcdefghijklmnopqrstuvwxyz '-" for c in key):
                continue
            definition = row["translation"].strip() or row["definition"].strip()
            if not definition:
                continue
            clean = lambda value: value.replace("\\n", "\n").strip()
            entry = [word, clean(row["phonetic"]), converter.convert(clean(row["pos"])), converter.convert(clean(definition))]
            buckets[shard(key)].setdefault(key, entry)
    # Apply s2twp exactly once to upstream text: phrase conversion is not
    # necessarily idempotent (e.g. transliterated proper names).
    if converter.convert("苹果 软件 记忆") != "蘋果 軟體 記憶":
        raise ValueError("Traditional Chinese conversion profile verification failed")
    opencc_files = distribution("OpenCC")
    license_file = next((file for file in opencc_files.files if str(file).endswith("/LICENSE")), None)
    if license_file is None:
        raise ValueError("OpenCC license is missing")
    opencc_license = Path(opencc_files.locate_file(license_file)).read_text(encoding="utf-8").rstrip() + "\n"
    targets = [source]
    if args.android_assets:
        targets.append(Path(args.android_assets).resolve() / "ecdict")
    count = sum(len(bucket) for bucket in buckets.values())
    manifest = {"source": "https://github.com/skywind3000/ECDICT", "revision": REVISION,
                "csvSha256": CSV_SHA256, "entries": count, "dataVersion": DATA_VERSION,
                "license": "MIT", "translation": "zh-TW",
                "conversion": {"tool": "OpenCC", "version": OPENCC_VERSION, "config": CONVERSION, "source": "https://github.com/BYVoid/OpenCC"},
                "format": "FNV-1a low byte; [word, phonetic, pos, definition]; English exact match"}
    for target in targets:
        target.mkdir(parents=True, exist_ok=True)
        for name, bucket in buckets.items():
            (target / f"{name}.json").write_text(json.dumps(bucket, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (target / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (target / "LICENSE.txt").write_text(license_text, encoding="utf-8")
        (target / "OpenCC-LICENSE.txt").write_text(opencc_license, encoding="utf-8")
        (target / "NOTICE.txt").write_text(f"ECDICT definitions modified for Vocab: converted to Traditional Chinese (Taiwan) using OpenCC {OPENCC_VERSION}, {CONVERSION}. ECDICT: MIT, https://github.com/skywind3000/ECDICT. OpenCC: Apache-2.0, https://github.com/BYVoid/OpenCC. English words/phonetics retained; no examples generated.\n", encoding="utf-8")
    print(f"Generated and verified {count} Traditional Chinese ECDICT entries across 256 shards for {len(targets)} projects.")

if __name__ == "__main__":
    main()
