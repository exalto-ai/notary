#!/bin/sh
# Install the latest Exalto Capture command-line tools for Apple silicon macOS or Linux.
set -eu

download_root="${NOTARY_DOWNLOAD_ROOT:-https://notary-prod-downloads.t3.tigrisfiles.io/releases}"
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

# The public command names are `capture` and `captured`, and the public verb
# for notarization is `seal`. Until the Runtime ships the renamed binaries
# (docs/adr/0003-public-cli-names.md), two shims make every documented command
# work. They resolve the sibling binary at run time, so `capture update` keeps
# working after the updater replaces notaryctl and notaryd in place.
cat > "$temporary_dir/captured" <<'SHIM'
#!/bin/sh
# Exalto Capture local service. Shim for notaryd; see docs/adr/0003-public-cli-names.md.
exec "$(dirname "$0")/notaryd" "$@"
SHIM
cat > "$temporary_dir/capture" <<'SHIM'
#!/bin/sh
# Exalto Capture command client. Shim for notaryctl; see docs/adr/0003-public-cli-names.md.
# `capture traces seal` is the public spelling of `notaryctl traces notarize`.
previous=""
count=$#
while [ "$count" -gt 0 ]; do
  argument=$1
  shift
  if [ "$previous" = "traces" ] && [ "$argument" = "seal" ]; then
    argument="notarize"
  fi
  previous=$argument
  set -- "$@" "$argument"
  count=$((count - 1))
done
exec "$(dirname "$0")/notaryctl" "$@"
SHIM
install -m 0755 "$temporary_dir/capture" "$install_dir/capture"
install -m 0755 "$temporary_dir/captured" "$install_dir/captured"

echo "Installed capture and captured $version from latest to $install_dir"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "Add $install_dir to your PATH, then run: captured" ;;
esac
