#!/bin/sh
# Railway pre-deploy: yangi versiya trafik olishdan oldin ishlaydi. Har qanday xato (set -e) deploy'ni
# to'xtatadi — eski versiya ishlashda davom etadi. Ikkalasi ham idempotent (qayta ishga tushirish xavfsiz).
set -eu

python manage.py migrate --noinput
python manage.py seed_subjects
