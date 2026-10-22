#!/usr/bin/env bash
# maktab365 autopilot: M promptlarini ketma-ket Claude Code bilan bajaradi.
# Ishlatish:  REPO=~/maktab365 ./run.sh [boshlanish] [tugash]
#   masalan:  REPO=~/maktab365 ./run.sh 0 3     (M0..M3)
#             REPO=~/maktab365 ./run.sh 4       (M4 dan oxirigacha)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:?REPO=/repo/yoli ni bering}"
FROM="${1:-0}"; TO="${2:-15}"
RETRIES="${RETRIES:-2}"
MAX_TURNS="${MAX_TURNS:-250}"
TOOLS="${TOOLS:-Bash Edit Write Read Glob Grep}"   # yoki: PERM=--dangerously-skip-permissions (faqat sandbox/konteynerda!)
PERM="${PERM:---allowedTools $TOOLS}"
mkdir -p "$HERE/logs"
cd "$REPO" || exit 1
git rev-parse --git-dir >/dev/null 2>&1 || { echo "REPO git repo emas"; exit 1; }

gate() {  # $1 = M raqami
  if [ "$1" -eq 0 ]; then
    (cd frontend && npm run typecheck && npm run build) 2>&1
  else
    make test 2>&1
  fi
}

for n in $(seq "$FROM" "$TO"); do
  id=$(printf "M%02d" "$n"); f="$HERE/prompts/$id.md"; log="$HERE/logs/$id.log"
  [ -f "$f" ] || { echo "$f yo'q"; exit 1; }
  echo "=== $id boshlandi $(date +%T) ==="
  # shell yangi sessiya: har M toza kontekstda
  claude -p "$(cat "$f")" $PERM --max-turns "$MAX_TURNS" >"$log" 2>&1 || echo "(claude nolga teng bo'lmagan kod bilan chiqdi, gate tekshiradi)"
  ok=0
  for try in $(seq 0 "$RETRIES"); do
    if out=$(gate "$n"); then ok=1; break; fi
    echo "--- gate yiqildi ($id), urinish $((try+1))/$((RETRIES+1))"
    echo "$out" >>"$log"
    [ "$try" -lt "$RETRIES" ] || break
    claude -p "Bosqich $id tugallanmadi: tekshiruv yiqildi. Quyidagi xatolarni tuzat va tekshiruvni qayta yurgiz, so'ng to'xta.

$(echo "$out" | tail -n 80)" --continue $PERM --max-turns 120 >>"$log" 2>&1
  done
  if [ "$ok" -ne 1 ]; then
    echo "!!! $id gate o'tmadi. To'xtatildi. Log: $log"; exit 2
  fi
  git add -A && git commit -qm "$id: autopilot (testlar yashil)" || true
  git tag -f "done-$id" >/dev/null
  echo "=== $id tayyor ✓ ==="
done
echo "Hammasi tayyor."
