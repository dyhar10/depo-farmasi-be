#!/usr/bin/env bash
# Dijalankan di server: ./deploy.sh <staging|production> [api|web|all] [tag]
# Dipakai oleh repo backend (api) dan repo frontend (web); tag tiap layanan disimpan di .tags.
# Urutan: tarik image -> migrasi (api/all) -> update layanan -> cek kesehatan.
# Backup produksi dilakukan pipeline sebelum skrip ini.
set -euo pipefail

ENVIRONMENT="${1:?pemakaian: deploy.sh <staging|production> [api|web|all] [tag]}"
TARGET="${2:-all}"
NEW_TAG="${3:-}"
cd "$(dirname "$0")"

: "${API_IMAGE:?}" "${WEB_IMAGE:?}"
[ -f .tags ] || printf 'API_TAG=main\nWEB_TAG=main\n' > .tags

set_tag() { # <KEY> <value>
  grep -v "^$1=" .tags > .tags.new || true
  echo "$1=$2" >> .tags.new && mv .tags.new .tags
}

case "$TARGET" in
  api) [ -n "$NEW_TAG" ] && set_tag API_TAG "$NEW_TAG" ;;
  web) [ -n "$NEW_TAG" ] && set_tag WEB_TAG "$NEW_TAG" ;;
  all) [ -n "$NEW_TAG" ] && { set_tag API_TAG "$NEW_TAG"; set_tag WEB_TAG "$NEW_TAG"; } ;;
  *) echo "target tidak dikenal: $TARGET" >&2; exit 2 ;;
esac

set -a; . ./.tags; set +a
export API_IMAGE WEB_IMAGE
COMPOSE=(docker compose -f docker-compose.deploy.yml)

echo "[$ENVIRONMENT/$TARGET] tarik image (api=$API_TAG web=$WEB_TAG)"
"${COMPOSE[@]}" pull

if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  echo "[$ENVIRONMENT] jalankan migrasi (kompatibel mundur: expand/contract)"
  "${COMPOSE[@]}" --profile migrate run --rm migrate
fi

echo "[$ENVIRONMENT] update layanan"
"${COMPOSE[@]}" up -d --remove-orphans

echo "[$ENVIRONMENT] tunggu API sehat"
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://localhost:3000/health/ready >/dev/null 2>&1; then
    echo "sehat"; cp .tags .tags.last_good; exit 0
  fi
  sleep 5
done

echo "GAGAL: API tidak sehat. Rollback: salin .tags.last_good ke .tags lalu jalankan ./deploy.sh $ENVIRONMENT all." >&2
exit 1
