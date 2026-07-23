# Funnel Spec — proposal, breadth, selection

Adapted from Lianggs8/auto-survey-agent's funnel SOP (MIT, authorized). The funnel's
property worth protecting: **every narrowing step is written down and gated before the
next widens the investment.**

## Part A: The proposal (gate 1)

Before any full scan, a small exploratory probe (2–3 queries, top 10–20 metadata
results) senses the field, and the proposal records:

- **Keyword sets** — 3–6 query families, including the synonyms the field actually
  uses and the "X for Y" phrasings papers title themselves with;
- **Apparent sub-directions** — from the probe, each with one example paper;
- **Selection criteria** — venue tier list, year window, and the mandatory rows
  (Part C) spelled out;
- **Target scale** — breadth ≥100 for a normal field; a narrow field states its honest
  smaller number rather than padding; pool 15–25;
- **Intended reader** — newcomer / practitioner / expert refresh; this sets the
  outline's altitude and the background section's existence.

The user approves, adjusts, or narrows — iterate until approved, then lock
(`stage.proposal: done`). A locked proposal is the scan's contract; changing it later
reopens the stage explicitly and says which downstream artifacts it invalidates.

## Part B: Breadth scan rules

- Metadata only: title, authors, venue, year, citation count, abstract, record URL.
  **No PDFs, no full texts** at this stage — breadth is cheap only if it stays shallow.
- All fetching through the refs family's source policy (`star-refs-reviewer`'s
  `references/source_policy.md`): the same endpoints, serialized with backoff, every
  payload cached under `wkdrs/survey_<date>/raw/` **before** its row is written,
  Google Scholar never scraped.
- Deduplicate by title (preprint vs published: keep the published venue's row).
- `broad_scan.md` records the full table sorted by sub-direction then citations,
  per-sub-direction counts, and the scan's limits (failed queries, caps hit). A scan
  that reached 70 of a targeted 100 reports 70 — the number is data.

## Part C: Selection (gate 2)

Fill the pool in this order, then rank the remainder:

1. **Mandatory — recent surveys** of the field (≤3 years): they calibrate the taxonomy
   and mark what a new survey must add;
2. **Mandatory — seminal works**: the most-cited anchors the field's story cannot be
   told without;
3. **Mandatory — the frontier**: last ~1 year's top-venue representatives per
   sub-direction;
4. **Ranked fill** to 15–25: coverage across sub-directions beats raw citation count;
   a sub-direction the outline will need must be represented.

Present the pool with one-clause justifications; the user strikes and adds freely
(their additions are fetched like any other). Record in `broad_scan.md`: the confirmed
pool, and one line per notable exclusion ("high citations but out of scope: …") — the
reader of the survey will ask; the file should already answer.

## Part D: Depth (delegated)

Each pool paper goes to `/star-refs-reviewer <arxiv-id | doi | url>` — append mode
fetches the authoritative record, writes `metds/refs/<ABBREV>.md`, and updates
`reference.bib` + `refs_index.md` under its own zero-fabrication rules. This skill
tracks coverage (a checklist in the proposal) and **waits**: no note, no
characterization. The division protects both sides — the survey never invents what a
note would have said, and the refs base stays under one owner's audit trail.
