#!/bin/sh
# Install git hooks from scripts/hooks/ into .git/hooks/
# Run once after cloning: npm run setup-hooks

HOOKS_DIR="$(git rev-parse --show-toplevel)/scripts/hooks"
GIT_HOOKS_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

for hook in "$HOOKS_DIR"/*; do
  name=$(basename "$hook")
  dest="$GIT_HOOKS_DIR/$name"
  cp "$hook" "$dest"
  chmod +x "$dest"
  echo "✓ Installed $name hook"
done

echo ""
echo "Git hooks installed. Build check will run before every push."
