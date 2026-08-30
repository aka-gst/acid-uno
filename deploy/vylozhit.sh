#!/bin/sh
# Выкладка ACID UNO на https://aka-gst.ru/acid/
#
# Список исключений — белый по духу: всё, что не про игру, на
# сайт не едет. Чёрный список забывает то, что появилось после
# него: так ФИНИШ.md — внутренние заметки с цитатами владельца —
# уже один раз уехал в веб-корень и был доступен снаружи.
#
# Поэтому здесь нет и не будет строк вида «исключить вот этот
# конкретный файл»: исключаются целые виды. Ни один .md на
# сайте не нужен — ни заметки, ни README. Папка /sfx в корне —
# чужая раскладка не нашего формата, игра просит assets/sfx;
# косая черта важна, без неё исключился бы и assets/sfx.
#
# После выкладки скрипт сверяет версию по содержимому живой
# страницы, а не по коду ответа: поверх уже трижды ложилась
# более ранняя копия папки.

set -e

cd "$(dirname "$0")/.."

rsync -az \
  --exclude '.git' \
  --exclude '.githooks' \
  --exclude 'node_modules' \
  --exclude 'deploy' \
  --exclude 'test' \
  --exclude 'server' \
  --exclude 'docs' \
  --exclude 'tools' \
  --exclude '.claude' \
  --exclude 'ФИНИШ.md' \
  --exclude 'CLAUDE.md' \
  --exclude '*.local.*' \
  --exclude '*.md' \
  --exclude '/sfx' \
  ./ bonita:/opt/zakriva/caddy/site/acid/

want=$(grep -o 'v=[0-9]\+' index.html | head -1)

echo "жду $want на бою"

i=0
while [ $i -lt 6 ]; do

  got=$(curl -s --max-time 10 https://aka-gst.ru/acid/index.html | grep -c "$want" || true)

  if [ "$got" -ge 20 ]; then
    echo "бой: $want, ссылок $got — совпало"
    exit 0
  fi

  i=$((i + 1))
  sleep 2
done

echo "НЕ СОВПАЛО: на бою нет $want. Смотри, не легла ли сверху старая копия."
exit 1
