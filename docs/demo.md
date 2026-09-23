# Demo video script (60s, OBS)

Goal: show the three claims a reviewer cares about — multi-provider chat,
hybrid RAG with citations, and audit/SYSLOG — in one continuous flow on the
hosted deployment. No cuts inside a step; cut between steps only.

**Setup before recording:** seeded workspace with 3–5 real-looking (synthetic)
documents, incl. one scanned PDF (proves the OCR path); browser at 1440×900;
German or English UI (pick one); DevTools closed; model selector visible.

| # | Time | Action | On-screen proof |
|---|------|--------|-----------------|
| 1 | 0:00–0:05 | Login via SSO (Authentik button, one click). | Enterprise SSO, not a password form. |
| 2 | 0:05–0:15 | Chat: ask a question, answer streams. Switch the model dropdown mid-conversation (e.g. GPT → Mistral), ask a follow-up. | Same conversation, two providers — the abstraction is real. |
| 3 | 0:15–0:35 | RAG: toggle document grounding on; ask something answerable only from the seeded docs — include an exact identifier (contract/statute number) so the **BM25 arm** visibly wins. Hover a citation chip to open the source snippet. | Answer with citations; the exact-ID query retrieving correctly = hybrid search working. |
| 4 | 0:35–0:45 | Open the scanned PDF in the document viewer; show extracted text side-by-side. | OCR microservice path. |
| 5 | 0:45–0:55 | Admin → audit trail: the actions from steps 2–4 appear (who, what, when). Click "Export SYSLOG" — show the stream/config. | Compliance is architecture: every action logged, SIEM export. |
| 6 | 0:55–1:00 | Settings → deployment info panel (on-prem badge). End frame on the landing/dashboard. | "Runs in the customer network." |

**Narration skeleton (record over, ~1 line per step):**
1. "Enterprise SSO — the customer's identity provider, not ours."
2. "Any provider per conversation — no lock-in, tracked per user."
3. "Answers cite the documents; exact identifiers route through the lexical arm of hybrid search."
4. "Scans go through our OCR service before retrieval."
5. "Every action is audited and exportable to the customer's SIEM via SYSLOG."
6. "All of it, inside the customer's network."

**After recording:** export 1080p MP4, drop as `docs/screenshots/demo.mp4`,
replace the `TODO-VIDEO` comment in README.md with the embed.
