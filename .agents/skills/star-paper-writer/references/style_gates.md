# Style Gates — mechanical, semantic, red team, compression

Adapted from SNL-UCSB/paper-writing-skill (MIT). Part A runs on **every tex edit** with
its grep counts pasted; Parts B–C close a section; Part D drives compression. These are
the **defaults** — `project_context.md` may override individual rules per paper (record
the override; the gate then skips that rule and says so).

## Part A: Mechanical gate (grep-backed — run it, paste the counts)

Run over the changed files (adjust paths as needed):

```bash
T=paper/sections/*.tex
grep -nE -- "---|—" $T                                   # M1 em-dashes (banned in prose)
grep -nE "\b(very|extremely|significantly|substantially|highly|remarkably)\b" $T   # M2 intensifiers
grep -nE "\b(novel|state-of-the-art|comprehensive|robust|promising|impressive)\b" $T  # M3 filler adjectives
grep -niE "\b(in order to|it should be noted|note that|to address this|we address this problem by)\b" $T  # M4 throat-clearing
grep -niE "\b(moreover|notably|furthermore|additionally),"$T                        # M5 throat-clearing openers
grep -niE "\b(can potentially|may help|it is possible that|can be expected to)\b" $T  # M6 hedging
grep -nE "\b(is|are|was|were|been|being) [a-z]+ed\b" $T                             # M7 passive voice (review hits)
grep -niE "\bIn this (paper|section|work), we (describe|present|discuss)\b" $T      # M8 content-free openers
awk 'length > 320' $T                                                               # M9 sentences likely > 40 words (heuristic)
grep -nE "!\B" $T                                                                   # M10 exclamation marks
grep -cE "\\\\cite" $T; grep -nE "[a-zA-Z]\\\\cite" $T                              # M11 missing ~ before \cite
grep -nE "et al\.[^~]" $T                                                           # M12 missing ~ after et al.
```

Rules of engagement: fix every hit or justify it in one line (a legitimate passive, an
em-dash inside a quoted title); report the counts per rule id — `M1: 0, M2: 3 fixed,
M7: 2 hits (1 fixed, 1 justified: agent unknown)`. **Never report the gate as passed
without having run the greps.** M9 is a heuristic — verify flagged lines by reading.

Voice defaults behind the greps: mean sentence ~21 words, max ~40 (contribution lists
only); topic sentences assert claims, never background; zero hedging ("We show", not
"We believe"); active voice throughout; headings are claims, not topics ("Edge
conditioning reduces error 13×", not "Experimental Results"); paragraphs 4–6 sentences,
each doing exactly one of claim / evidence / takeaway; named over vague — every
mechanism, baseline, and metric carries its proper name.

## Part B: Semantic gate (reader judgment — checklist, applied line by line)

- **S1 define-before-use**: every symbol, acronym, and named concept defined at first
  occurrence; the key abstraction introduced before it is relied on.
- **S2 followability**: a reader who knows the venue but not this project can follow
  each paragraph from its predecessor; no forward references that force a re-read.
- **S3 thesis-tie**: every paragraph traceably serves the identity sentence; a paragraph
  that serves no claim is deleted or moved.
- **S4 lexical consistency**: one name per concept across the whole paper (grep the
  synonyms); notation stable (no f vs F drift).
- **S5 non-duplication**: no fact stated twice because two sections both wanted it;
  state once, reference after.
- **S6 figure interpretation**: every figure/table is interpreted in prose ("Figure 3
  shows X, confirming Y"), never just cited; captions carry a bold takeaway plus at
  most one clause.
- **S7 honest positioning**: related-work characterizations within the notes' depth;
  no strawmen; limitations named where a reviewer would find them anyway.
- **S8 claim-scope match**: wording sized to the evidence — "in the evaluated settings"
  where `results.md` says single-seed or single-benchmark.
- **S9 closure**: section openers state what the section concludes; every evaluation
  cluster ends in a Takeaway; the conclusion promises nothing new.

## Part C: Red team (fresh eyes before a section closes)

After the author pass fixes Parts A–B, re-review the text as a reviewer who did **not**
write it: re-run the Part A greps from scratch, walk Part B with a fresh-reader lens,
and return a findings list (CRITICAL / MAJOR / MINOR), not a yes/no. In this family the
red team runs as a read-only collector pass (conventions §6) where scale warrants —
one collector per section, main loop judges — or as a deliberate re-read on small
drafts. Iterate until a final pass returns zero CRITICAL/MAJOR; never close a section
with residual criticals "noted".

## Part D: Compression (seven operations, in order)

1. **Sentence shortening** — remove subordinate clauses, qualifiers, throat-clearing.
2. **Paragraph merging** — several examples of one point → the single best example.
3. **Generic-adjective removal** — each becomes a specific number or disappears.
4. **Tutorial deletion** — cut what the venue's audience already knows.
5. **Claim-first conversion** — rewrite buried paragraphs so the claim leads.
6. **Takeaway insertion** — add the synthesis paragraph after each experiment cluster
   (compression by clarity: it replaces re-reading).
7. **Figure/table promotion** — dense numeric prose becomes a table; the prose keeps
   the interpretation only.

Report per-section character counts before/after; target 30–50% from first draft; over
50% signals a framing problem, not a wordiness problem — say so and route to the
context. Never pad toward a page limit: short and complete beats padded.
