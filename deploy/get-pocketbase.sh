#!/usr/bin/env sh
# Fetch the pinned PocketBase release into pocketbase/.
# Usage: ./deploy/get-pocketbase.sh          (auto-detects OS/arch)
# Upgrades later: cd pocketbase && ./pocketbase update && restart the service.
set -eu

VERSION=0.40.3   # the version the migrations/hooks were tested against
DIR="$(cd "$(dirname "$0")/../pocketbase" && pwd)"

case "$(uname -s)" in
	Linux) OS=linux ;;
	Darwin) OS=darwin ;;
	*) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
	x86_64) ARCH=amd64 ;;
	aarch64 | arm64) ARCH=arm64 ;;
	*) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

FILE="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${FILE}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading ${FILE}…"
curl -fsSL -o "$TMP/$FILE" "$URL"
curl -fsSL -o "$TMP/checksums.txt" \
	"https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/checksums.txt"
(cd "$TMP" && grep " ${FILE}\$" checksums.txt | sha256sum -c -)

unzip -oq "$TMP/$FILE" pocketbase -d "$DIR"
chmod +x "$DIR/pocketbase"
echo "Installed: $("$DIR/pocketbase" --version)"
