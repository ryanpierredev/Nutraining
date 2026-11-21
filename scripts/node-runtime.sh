# Source from deployment scripts after changing to the repository root.
if [[ -x "$PWD/.runtime/node/bin/node" ]]; then
  export PATH="$PWD/.runtime/node/bin:$PATH"
fi
