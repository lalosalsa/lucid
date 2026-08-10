# Lucid — Product Brief

*Paste everything below into Claude to get a business plan. Edit the bracketed
parts first — they're the things only you know.*

---

I'm building a product called **Lucid** and I need your help turning it into a
business plan. Here's everything about it. Ask me clarifying questions where the
information below is thin, then produce the plan.

## What it is

Lucid is a voice-first thinking and tracking app for people running businesses.
You talk; it listens, sharpens what you said into a clean note, pushes your
thinking further, and files it under the business or idea it belongs to.

The one-line version: **talk out loud about your business, and get back
structure, sharper thinking, and a running picture of where everything stands.**

It is deliberately *not* a note-taking app. Notes apps store what you said.
Lucid's core promise is that what you get back is **better than what you put
in** — and that it accumulates into something that answers "where does this
business actually stand?"

## The problem it solves

People who run businesses think in motion — driving between jobs, walking out of
a meeting, lying awake at 11pm. Those thoughts are the most valuable raw material
they produce, and almost all of it is lost:

1. **Capture friction.** Typing a real thought on a phone takes minutes they
   don't have, so it never gets written down.
2. **Voice notes are a graveyard.** The ones who do record end up with 200
   untitled audio files nobody will ever listen to again.
3. **Notes are inert.** Even written down, a note just sits there. Nobody
   re-reads it, nothing challenges it, no one asks the obvious question.
4. **No sense of state.** Someone running a company while exploring two side
   ideas has their thinking scattered across three apps and can't answer "what's
   actually happening with each of these?" without re-reading everything.

The gap: capture tools are passive, and project tools demand structure you have
to maintain by hand. Nothing sits in the middle and does the organizing *and*
the thinking for you.

## Who it's for

**Primary: the solo operator / owner-founder.** Runs a real business — trades,
services, agency, e-commerce, small SaaS — usually 1–20 people. Is the strategy
function *and* the operations function. Thinks constantly, writes almost nothing
down. Not a "productivity system" person; has tried Notion and abandoned it.
Often has a second or third idea running in the background.

**Secondary: the multi-venture entrepreneur.** Actively runs one thing while
evaluating others. Their core pain isn't capture — it's keeping several
ventures separate and knowing which deserves attention this month.

**Tertiary: consultants, coaches, solo professionals** who think out loud
between client sessions and need each client/engagement tracked separately.

**Explicitly not for (today):** teams needing collaboration, enterprises needing
compliance, or anyone wanting a full project-management tool. Single-player by
design right now.

## How it works

1. **Tap once and talk.** Recording starts immediately — no menus. Up to 90
   seconds per capture. (Typing is always available as a fallback.)
2. **Transcription.** Audio is transcribed server-side (Google Gemini Flash).
3. **Structuring and thinking (Anthropic Claude).** The note comes back split
   into two clearly separated halves:
   - **What you said** — a sharpened one-line thesis plus bullet points, held
     strictly to what you actually said. It never invents facts, numbers, or
     decisions. This matters: it's a business record.
   - **What Lucid adds** — *Questions to answer* (the sharp ones a good
     co-founder would ask), *Angles to consider* (directions you didn't
     mention), and *Watch out for* (the blind spot or the assumption carrying
     the most weight).
4. **It files itself.** The note is routed to the right business or idea
   automatically, so organizing costs zero taps.
5. **Go deeper.** Any note opens into a conversation that already has the full
   context — no re-explaining. Tuned to behave like a sharp co-founder in a
   hallway, not a consultant writing a report.
6. **"Where it stands."** Open a business and Lucid reads *everything* captured
   about it over time and reports what's moving, what's stuck or repeatedly
   deferred, and what deserves attention next.
7. **Tasks, opt-in.** Lucid suggests next steps but never adds them to your list
   on its own — you tap to accept. You can also type a task directly, add one
   inside a note, or just say *"add task: call the supplier"* and it's
   captured as a task, not a note.
8. **Capture doesn't require AI at all.** You can talk or type and get the full
   structuring treatment, or just write a plain note (or save a dictated/typed
   thought "as-is") with zero model calls and zero cost. A raw note can be
   **expanded with AI** later, on demand — the thinking is always opt-in, never
   forced, and never charged unless asked for.

There are three capture "lenses" — Operator (bias to momentum and next steps),
Analyst (rigorous, literal, flags open questions), Meeting (decisions, owners,
follow-ups).

## What's actually built today

A working, deployed web app (mobile-first, installable to a phone home screen).
Voice capture, transcription, AI structuring (optional and on-demand), thinking
sections, auto-filing to businesses, per-business rollups, the follow-up
conversation, tasks (suggested, manual, and voice-command), plain manual notes,
read-aloud, search, sorting, and JSON backup/restore. Serverless backend; API
keys held server-side. AI cost is tunable per feature (economy/balanced/quality
model presets — a cheap model handles high-volume capture, a stronger one is
reserved for the on-demand reasoning features) so unit costs stay low and
predictable. Covered by an automated browser test suite (50+ checks).

## Known gaps (be realistic about these in the plan)

- **No accounts or sync.** Data lives in one browser's local storage. It doesn't
  follow the user to another device, and clearing browser data loses it. Backup
  is a manual file export. This is the single biggest barrier to charging money
  and to trust — someone won't log their business in something that can vanish.
- **No team features.** Single-player only.
- **Per-use API cost, though now tunable and small.** Every AI-assisted action
  costs money, but plain capture is free (no model call), and the default model
  mix keeps AI-assisted capture around $0.35–$1 per 100 captures at list API
  prices. Unit economics still need to be in the pricing model, but they're a
  known, controllable input rather than an open question.
- **No native mobile app** (web only, though installable).
- **Retention is unproven.** No real usage data yet.

## Competitive landscape

- **Otter / Rev / voice recorders** — transcribe accurately but produce walls of
  text; no thinking, no structure, no state.
- **Granola / Fathom** — excellent for *meetings*; Lucid is for the thinking
  between meetings, and for solo thought.
- **Notion / Obsidian** — powerful but demand you build and maintain the system.
- **Apple Notes / Google Keep** — zero friction, zero intelligence.
- **Todoist / Things** — manage tasks you already know about; don't help you
  figure out what the tasks should be.

The wedge: **capture as easy as a voice memo, output better than a strategy
session, organized without any effort.**

## What I need from you

Write a business plan for Lucid. Cover:

1. **Executive summary** — the thing in a paragraph.
2. **Problem and market** — who hurts, how much, roughly how many of them there
   are (state your assumptions and how you'd validate them).
3. **Product and differentiation** — what's genuinely defensible here versus what
   a competitor could copy in a quarter, and what to build to widen the moat.
4. **ICP and go-to-market** — which *one* beachhead segment to win first and why,
   and 2–3 concrete channels to reach them. Be specific, not "content marketing."
5. **Pricing and unit economics** — a recommended model, given real per-capture
   API costs. Include a rough per-user cost estimate and the gross-margin math.
6. **Roadmap** — what must ship before charging money (be blunt about the sync
   and data-durability gap), then the next two phases.
7. **Risks** — the three most likely reasons this fails, and what would have to
   be true for it to work.
8. **First 90 days** — a concrete plan to get to first paying users, including
   what to validate before building anything else.

Be direct and specific. Push back on anything above that you think is wrong or
weakly reasoned — I'd rather hear it now. Where you need numbers I haven't
given you, state your assumption explicitly rather than being vague.

## Context about me (fill this in)

- My background: [e.g. I run a landscaping company / I'm a developer / etc.]
- Time available: [full-time / nights and weekends]
- Budget: [what you can spend to get to first users]
- Goal: [lifestyle business at $X/mo / venture-scale / sell it / just useful to me]
- Do I already have access to the target customer? [e.g. "I'm in 3 Facebook
  groups with 5,000 contractors" — this matters enormously for GTM]
