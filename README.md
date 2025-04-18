# 手元でサムネを生成してみる
```bash
$ npm install
# 例
# cloudflare-pages-functions.mdのサムネをthumbnail配下に生成します。
# articles.json内でcloudflare-pages-functions.mdのthumbnailが空である必要があります。
$ export CHANGED_FILES_LIST=cloudflare-pages-functions.md && node scripts/gen-thumbnail.js
```

# 記事一覧を更新する
```bash
$ node scripts/update-articles.js
```