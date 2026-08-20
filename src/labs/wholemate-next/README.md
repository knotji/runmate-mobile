# WholeMate Next — frozen, reference only

**Do not extend this prototype.** As of 2026-08-20, all four `/tabs/*` pages
(Today, Health, Move, You) have been promoted to the WholeMate visual
language this folder explored:

- Move → `src/pages/ActivityPage.tsx`
- Health → `src/pages/HealthPage.tsx`
- You → `src/pages/MorePage.tsx`
- Today → `src/pages/RecoveryPage.tsx` (already matched this language from
  the `98620ca` rebrand commit — no separate promotion pass was needed)

This directory is kept around only as a proven reference — something to
visually diff a real-device regression against — not as a place for new
design exploration. New feature work belongs in the real `/tabs/*` pages.

**Removal plan:** once real-device QA is clean across all four promoted
tabs and one full release has shipped with them, delete this entire
directory plus the `/labs/*` route block in `src/App.tsx`.
