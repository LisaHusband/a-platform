#!/usr/bin/env bash
# 公共函数库 / shared helpers, sourced by every deploy script.
# shellcheck shell=bash

set -euo pipefail

# 颜色与日志 / colored logging
log()  { printf '\033[0;36m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"; }
ok()   { printf '\033[0;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[WARN]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[0;31m[FAIL]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# 必需变量校验 / require an env var to be set and non-empty
require_var() {
  local name="$1"
  [ -n "${!name:-}" ] || die "缺少必需环境变量 / missing required env var: $name"
}

# 命令存在性 / command exists
has_cmd() { command -v "$1" >/dev/null 2>&1; }
