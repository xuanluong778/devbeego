#!/usr/bin/env bash
# Register VPS deploy public key on GitHub repo xuanluong778/beego (one-time).
# Requires: gh CLI + GITHUB_TOKEN (classic: repo, or fine-grained: Contents read + Administration).
set -euo pipefail

REPO="${GITHUB_REPO:-xuanluong778/beego}"
KEY_FILE="${DEPLOY_KEY_PUB:-/var/www/beego_vn_usr/data/.ssh/beego_deploy_ed25519.pub}"
TITLE="${DEPLOY_KEY_TITLE:-beego.vn VPS deploy (read-only)}"
READ_ONLY="${DEPLOY_KEY_READ_ONLY:-true}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing public key: $KEY_FILE"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Set GITHUB_TOKEN (PAT with repo admin or deploy key permission), then re-run."
  exit 1
fi

command -v gh >/dev/null || { echo "Install gh: apt install gh"; exit 1; }

echo "$GITHUB_TOKEN" | gh auth login --hostname github.com --with-token

PUB="$(tr -d '\n' < "$KEY_FILE")"
gh api "repos/${REPO}/keys" \
  -f title="$TITLE" \
  -f key="$PUB" \
  -F read_only="$READ_ONLY"

echo "Deploy key added to ${REPO}."
