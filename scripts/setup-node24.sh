#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd -P)
RUNTIME="$ROOT/.runtime"
if [[ -x "$RUNTIME/node/bin/node" ]] && [[ "$("$RUNTIME/node/bin/node" -p 'process.versions.node.split(".")[0]')" == 24 ]]; then
  "$RUNTIME/node/bin/node" --version
  exit 0
fi
for tool in curl sha256sum tar uname awk; do
  command -v "$tool" >/dev/null || { echo "Ferramenta necessária ausente: $tool" >&2; exit 1; }
done
case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo 'Arquitetura não suportada.' >&2; exit 1 ;;
esac
mkdir -p "$RUNTIME"
TEMP=$(mktemp -d "$RUNTIME/download.XXXXXX")
trap 'rm -rf "$TEMP"' EXIT
BASE=https://nodejs.org/dist/latest-v24.x
curl --fail --silent --show-error --location "$BASE/SHASUMS256.txt" -o "$TEMP/SHASUMS256.txt"
ARCHIVE=$(awk -v suffix="-linux-$ARCH.tar.xz" '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-/ && substr($2, length($2)-length(suffix)+1) == suffix {print $2}' "$TEMP/SHASUMS256.txt")
[[ "$ARCHIVE" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { echo 'Manifesto oficial inesperado.' >&2; exit 1; }
curl --fail --silent --show-error --location "$BASE/$ARCHIVE" -o "$TEMP/$ARCHIVE"
awk -v name="$ARCHIVE" '$2 == name {print}' "$TEMP/SHASUMS256.txt" > "$TEMP/checksum.txt"
(cd "$TEMP" && sha256sum --check checksum.txt)
tar -xJf "$TEMP/$ARCHIVE" -C "$TEMP"
DIRECTORY=${ARCHIVE%.tar.xz}
# Never replace an existing installation blindly.
[[ ! -e "$RUNTIME/$DIRECTORY" && ! -e "$RUNTIME/node" && ! -L "$RUNTIME/node" ]] || { echo 'Runtime existente inesperado; preserve-o e investigue antes de substituir.' >&2; exit 1; }
"$TEMP/$DIRECTORY/bin/node" --version
mv "$TEMP/$DIRECTORY" "$RUNTIME/$DIRECTORY"
ln -s "$DIRECTORY" "$RUNTIME/node"
echo 'Node 24 instalado apenas para o Nutraining. Node global preservado.'
