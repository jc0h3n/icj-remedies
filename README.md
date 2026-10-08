# What the Court Ordered

https://jc0h3n.github.io/icj-remedies/

Remedies at the World Court: the International Court of Justice (since 1946) and the Permanent Court of International Justice (1922–1946), shown separately or together. For every case the site shows:

- what the Court found: a breach, a boundary decided, claims rejected, or no decision on the merits;
- the remedies it granted, in seven categories: provisional measures; declaratory judgments; specific performance (including a duty to negotiate); cessation, assurances and guarantees of non-repetition; restitution in kind (including withdrawal from territory); compensation; satisfaction;
- what remedies it was asked for and refused;
- every provisional measures order and what it required;
- the remedial consequences stated in advisory opinions.

## Data

| Source | Used for | License |
|---|---|---|
| [Corpus of Decisions: International Court of Justice](https://doi.org/10.5281/zenodo.3826444) (Seán Fobbe) | Text of every decision up to the newest corpus version (currently October 2023); the operative part is extracted and split into points and votes | CC0 |
| [CD-ICJ source data](https://codeberg.org/seanfobbe/cd-icj) | Party names and UN regions | GPL-3.0 (code repository) |
| [International Court of Justice](https://www.icj-cij.org/list-of-all-cases) | Case list, pending cases, and decisions newer than the corpus (titles, dates, links) | Public |
| [PCIJ Series A, B and A/B](https://www.icj-cij.org/pcij) | Every Permanent Court judgment, order and advisory opinion, linked from the site | Public |
| `data/pcij.json` | Hand coding of the Permanent Court's 30 contentious cases and 27 advisory opinions | This repository |
| `data/coding.json`, `data/recent.json` | Hand coding of outcomes and remedies, with one-line summaries | This repository |

How the coding works:

- **Merits, compensation and interpretation judgments, and advisory opinions** are coded by hand, read against each decision's operative part.
- **Preliminary-objection judgments and provisional measures orders** are classified by rules (`scripts/classify.mjs`) and spot-checked. Corrections go in `data/coding.json`.
- **Decisions after the corpus** are coded from the ICJ's published summaries; their text is not reproduced.

The ICJ's PDFs sit behind a bot check and are not downloaded. When the weekly job finds a new decision that hasn't been coded, the site lists it as awaiting coding.

## Running it locally

Requires Node.js 20 or newer. No packages to install.

```
npm run data    # download the corpus and ICJ lists, build site/data/icj.json
npm run serve   # http://localhost:8080
```

A GitHub Action refreshes the data every Monday, commits the extracts in `data/`, and redeploys the site.

## Privacy

The site is static. It loads no fonts, analytics, trackers or third-party scripts.
