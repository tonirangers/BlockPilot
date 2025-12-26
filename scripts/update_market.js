name: Update market data
on:
  workflow_dispatch:
  schedule:
    - cron: "15 2 * * *"

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: node scripts/update_market.js
      - run: |
          if git diff --quiet; then
            echo "No changes"
            exit 0
          fi
          git config user.name "market-bot"
          git config user.email "market-bot@users.noreply.github.com"
          git add data/market.json
          git commit -m "chore: update market.json"
          git push
