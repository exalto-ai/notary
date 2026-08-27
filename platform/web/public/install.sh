#!/bin/sh
# Install the latest Exalto Notary Protocol command-line tools for Apple silicon macOS or Linux.
set -eu

download_root="${NOTARY_DOWNLOAD_ROOT:-https://notary.exalto.ai/downloads/releases}"
install_dir="${NOTARY_INSTALL_DIR:-${HOME}/.local/bin}"

system="$(uname -s)"
machine="$(uname -m)"

case "$system" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *) echo "The Exalto CLI installer supports macOS and Linux." >&2; exit 1 ;;
esac

case "$machine" in
  x86_64|amd64) architecture="x86_64" ;;
  arm64|aarch64) architecture="aarch64" ;;
  *) echo "Unsupported CPU architecture: $machine" >&2; exit 1 ;;
esac

if [ "$platform" = "darwin" ] && [ "$architecture" != "aarch64" ]; then
  echo "The Exalto CLI installer supports Apple silicon Macs; Intel Macs are not supported." >&2
  exit 1
fi

pointer="$(curl -fsSL "$download_root/latest")"
case "$pointer" in
  *" "*) ;;
  *) echo "The latest release pointer is malformed" >&2; exit 1 ;;
esac
build_id="${pointer%% *}"
version="${pointer#* }"
case "$build_id" in
  ""|.*|*..*|*[!a-zA-Z0-9._-]*)
    echo "The latest build identifier is malformed" >&2
    exit 1
    ;;
esac
case "$version" in
  ""|.*|*..*|*" "*|*[!a-zA-Z0-9._-]*)
    echo "The latest version is malformed" >&2
    exit 1
    ;;
esac

archive="notary-runtime-${version}-${platform}-${architecture}.tar.gz"
build_url="$download_root/builds/$build_id"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT INT TERM

curl -fsSL "$build_url/$archive" -o "$temporary_dir/$archive"
curl -fsSL "$build_url/$archive.sha256" -o "$temporary_dir/$archive.sha256"
expected="$(awk '{print $1}' "$temporary_dir/$archive.sha256")"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$temporary_dir/$archive" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$temporary_dir/$archive" | awk '{print $1}')"
fi
if [ "$expected" != "$actual" ]; then
  echo "Checksum verification failed for $archive" >&2
  exit 1
fi

tar -xzf "$temporary_dir/$archive" -C "$temporary_dir"
mkdir -p "$install_dir"
install -m 0755 "$temporary_dir/notary-runtime-${version}-${platform}-${architecture}/notaryctl" "$install_dir/notaryctl"
install -m 0755 "$temporary_dir/notary-runtime-${version}-${platform}-${architecture}/notaryd" "$install_dir/notaryd"

echo "Installed notaryctl and notaryd $version from latest to $install_dir"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "Add $install_dir to your PATH, then run: notaryd" ;;
esac
