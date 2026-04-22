# GitHub Chartify

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data/chartify-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="data/chartify.svg" />
  <img src="data/chartify.svg" />
</picture>

This tool reads a public GitHub contribution graph and renders it as an animated SVG bar chart, grouped by week or day.

## Try it

[Try it on the project page](https://iranovianti.com/portfolio/github-chartify/#try-it).

You can also change the grids to circles (`style: circles`):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data/chartify-circles-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="data/chartify-circles.svg" />
  <img src="data/chartify-circles.svg" />
</picture>

Or show only the weekly chart (`mode: vertical`):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data/chartify-vertical-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="data/chartify-vertical.svg" />
  <img src="data/chartify-vertical.svg" />
</picture>

Or only the daily chart (`mode: horizontal`):

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data/chartify-horizontal-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="data/chartify-horizontal.svg" />
  <img src="data/chartify-horizontal.svg" />
</picture>

## Usage

I made this mainly as a GitHub Action for profile READMEs.

### As a GitHub Action

1. Create a workflow at `.github/workflows/update-chart.yml`:

```yaml
name: Update contribution chart

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: iranovianti/github-chartify@v1
        with:
          username: ${{ github.repository_owner }}
          # other options here
      - run: |
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add data/
          git diff --staged --quiet || git commit -m "Update chart"
          git pull --rebase
          git push
```

2. Embed in your profile README:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data/contributions-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="data/contributions.svg" />
  <img src="data/contributions.svg" />
</picture>
```

Example on my profile: [github.com/iranovianti](https://github.com/iranovianti).

### From the command line

Clone the repo and run:

```
git clone https://github.com/iranovianti/github-chartify
cd github-chartify
node scripts/cli.js --username <username>
```

With options:

```
node scripts/cli.js --username <username> --speed slow --mode vertical --style circles
```

Output goes to `data/` by default. Override with `--output`.

## Options

| Option | Default | Description |
|-------|---------|-------------|
| `username` | repo owner | GitHub username |
| `output` | `data/contributions.svg` | SVG output path |
| `speed` | `fast` | `fast`, `medium`, or `slow` |
| `mode` | `both` | `both`, `vertical`, or `horizontal` |
| `loop` | `true` | Loop animation |
| `style` | `rectangle` | `rectangle` or `circles` |
