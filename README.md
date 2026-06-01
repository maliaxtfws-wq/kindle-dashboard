# Kindle Dashboard Pages

GitHub Actions generates a Kindle-sized dashboard image and GitHub Pages hosts it.

After publishing, point the Kindle client at:

`https://<github-user>.github.io/<repo-name>/dashboard.png`

Defaults:

- Size: 758 x 1024 for Kindle Paperwhite 2
- Time zone: Asia/Shanghai
- City: Chongqing / 重庆
- Refresh schedule: every 10 minutes via GitHub Actions

Edit `data/todos.txt` for the bottom task list.
