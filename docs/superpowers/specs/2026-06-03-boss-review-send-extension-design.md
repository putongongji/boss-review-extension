# Boss Review Sender Chrome Extension Design

## Goal

Build a Chrome extension for Boss Zhipin that helps the user scan job listings, collect job details across pages, generate JD-specific greeting messages from the user's resume, and send only after explicit human review.

The product should reduce repetitive job-search work while preserving user control. It must not run unattended bulk messaging.

## Source Reference

The design borrows the useful architecture patterns from `Ocyss/boss-helper`:

- WXT browser extension structure.
- Main-world page injection for access to Boss page runtime objects.
- Job pipeline for filtering, enrichment, status, logs, and statistics.
- Local duplicate tracking by company and recruiter.
- Rate-limit and daily-limit awareness.

This project should not copy its high-risk defaults:

- No unattended batch sending.
- No automatic replies.
- No multi-account cookie switching.
- No bypass behavior for verification, captcha, login anomalies, or platform limits.

## User Experience

The extension appears as a right-side assistant panel on Boss job-list pages. The interface should feel like a quiet productivity tool: dense enough for repeated use, but simple and polished.

Primary user flow:

1. User opens a Boss job-list page.
2. User clicks `Scan Current Page` or configures page/job limits and clicks `Scan Pages`.
3. Extension collects jobs from the current and subsequent pages.
4. Extension enriches each job with details, filters obvious duplicates or excluded roles, and generates a match score.
5. Extension generates one greeting draft for each reviewable job.
6. User reviews each job and chooses `Send`, `Rewrite`, `Copy`, `Skip`, or `Blacklist`.
7. Only a user click on `Send` triggers a message action.
8. Extension logs all outcomes locally.

## Visual Direction

Pattern: compact review dashboard inside a browser extension side panel.

Style:

- Minimal, premium, professional.
- White or near-white surface with subtle borders.
- Dark neutral text.
- Teal accent for match/status.
- Orange accent reserved for primary send action.
- 8px or smaller border radius.
- No decorative gradients, floating cards, marketing hero sections, or nested cards.
- Icon buttons for repeated actions such as refresh, pause, copy, rewrite, blacklist, and send.
- Clear focus states and semantic buttons.

Panel structure:

```text
Boss Review Sender
[Scan Current] [Scan Pages] [Pause]
5 pages · 100 jobs · human reviewed

Stats
Scanned 42 · High 9 · Review 12 · Sent 3 · Skipped 8

Queue
Product Manager · Company A · 86
AI Product · Company B · 79
...

Current Job
JD summary
Resume evidence
Greeting draft
[Send] [Rewrite] [Copy] [Skip] [Blacklist]
```

Target panel width: 420-520px. It should remain usable on narrower browser windows by collapsing metadata and preserving the review actions.

## Scope

MVP includes:

- WXT + Vue + TypeScript Chrome extension.
- Boss job-list page detection and panel mounting.
- Current-page job capture.
- Multi-page job capture with configurable page and job limits.
- Job detail enrichment.
- Local resume source configuration.
- LLM-based match scoring and greeting generation.
- Human review queue.
- Manual send, rewrite, copy, skip, and blacklist actions.
- Same-company and same-recruiter duplicate prevention.
- Local logs and daily review/send counters.
- Pause and stop controls.

MVP excludes:

- Unattended automatic sending.
- Multi-account cookie storage or switching.
- Automatic chat replies.
- Map distance filtering.
- Commercial key management.
- Circumventing platform verification, captcha, login, or rate limits.

## Page Integration

The extension has three runtime layers:

1. `content script`
   - Matches `*://zhipin.com/*` and `*://*.zhipin.com/*`.
   - Loads CSS.
   - Injects the main-world script.
   - Bridges messages between page runtime and extension background.

2. `main-world script`
   - Runs in the page context.
   - Mounts the Vue panel into the Boss page.
   - Reads page runtime data when available.
   - Observes route changes and reinitializes adapters.

3. `background`
   - Stores settings, resume material, logs, dedupe keys, and local counters.
   - Calls LLM providers if the selected provider requires extension-side execution.
   - Keeps content scripts free of persistent secrets where practical.

## Job Capture

The job adapter should prefer page runtime data, then fall back to DOM extraction.

Preferred path:

- Locate Boss page Vue root or job-list component.
- Read `jobList`, `jobDetail`, and page click handlers when available.
- Use page functions to select a job and wait for matching detail data.

Fallback path:

- Read job cards from DOM.
- Extract visible fields and stable ids from links or attributes.
- Click a job card when details are needed.
- Wait for detail panel content to change before extracting JD text.

The adapter returns normalized records:

```ts
interface CapturedJob {
  jobId: string
  securityId?: string
  lid?: string
  title: string
  company: string
  salary?: string
  location?: string
  experience?: string
  degree?: string
  recruiterName?: string
  recruiterTitle?: string
  recruiterId?: string
  companyId?: string
  activeText?: string
  skills: string[]
  welfare: string[]
  jdText?: string
  sourceUrl: string
}
```

## Multi-Page Scanning

Scanning is user-initiated and bounded.

Default limits:

- Max pages: 5.
- Max jobs: 100.
- Page interval: randomized delay.
- Detail interval: randomized delay.

Flow:

1. Capture current page jobs.
2. Enrich jobs that are not already captured.
3. Add jobs to the review queue.
4. If page/job limits are reached, stop.
5. Find next-page action from page runtime or DOM.
6. Click next page.
7. Wait until the first visible job id changes or the list content changes.
8. Repeat.

Stop conditions:

- User pauses or stops.
- Page limit reached.
- Job limit reached.
- No next page.
- Login anomaly.
- Captcha or verification prompt.
- Rate-limit warning.
- Repeated extraction failure.

The scanner never sends messages.

## Processing Pipeline

Each job moves through a deterministic pipeline:

1. Normalize fields.
2. Check local sent/skipped history.
3. Check same company and same recruiter dedupe.
4. Apply blacklist.
5. Apply simple keyword filters.
6. Enrich detail if needed.
7. Score JD against resume.
8. Generate greeting draft.
9. Enter review queue.

Each job status is one of:

```ts
type JobStatus =
  | 'captured'
  | 'enriching'
  | 'filtered'
  | 'scoring'
  | 'drafted'
  | 'reviewing'
  | 'sent'
  | 'skipped'
  | 'failed'
```

## Resume And Greeting Generation

Default resume material path for local development:

`/Users/sanjin/无用/find_job/简历.md`

The extension UI should also allow the user to paste or update resume material inside extension storage, because Chrome extensions cannot rely on direct filesystem reads in production.

Greeting formula:

```text
short greeting + preview hook + matching evidence + low-cost next step
```

Generation constraints:

- Chinese by default.
- 80-120 Chinese characters by default.
- Never invent experience, numbers, companies, tools, or titles.
- Use only resume material and JD content as evidence.
- Prefer concrete proof over generic enthusiasm.
- Show the selected resume evidence next to the draft.
- Show a warning if evidence is weak or generated text may be too generic.

The generator should return structured data:

```ts
interface GreetingResult {
  score: number
  scoreLabel: 'high' | 'medium' | 'low'
  jdSummary: string
  matchedEvidence: string[]
  risks: string[]
  greeting: string
  rationale: string
}
```

## Human Review And Sending

Sending is always manually triggered.

The `Send` button should be disabled until:

- A specific job is selected.
- A greeting draft exists.
- The user is logged in on Boss.
- No verification or rate-limit warning is visible.

When the user clicks `Send`:

1. Confirm current job and greeting.
2. If needed, establish the Boss communication relation using the page's normal available action.
3. Insert or send the greeting through a page-supported channel.
4. Log the outcome.
5. Store company and recruiter dedupe keys.

If direct page chat sending is unstable, MVP can fall back to copying the greeting and focusing the Boss chat input. The UI should clearly mark this as `Copy + Focus`, not a completed send.

## Data Storage

Use extension local storage for:

- Settings.
- Resume material.
- LLM provider configuration.
- Captured job cache.
- Sent and skipped history.
- Company and recruiter dedupe sets.
- Blacklist.
- Daily counters.
- Error logs.

No cookie export/import feature is included.

## Error Handling

The app should fail closed.

Pause scanning or sending when:

- Boss shows captcha or verification.
- Login state is lost.
- Network calls repeatedly fail.
- DOM/page runtime adapter cannot identify current page state.
- Boss rate-limit warning appears.
- Message sending channel is unavailable.

Display errors in plain language with a next action:

- `Paused: verification detected. Please resolve it in Boss, then resume.`
- `Send channel unavailable. Greeting copied; please paste manually.`
- `Job detail failed after 3 attempts. Skipped this job.`

## Testing And Verification

Minimum verification for MVP:

- Extension builds successfully.
- Panel mounts on Boss job-list pages.
- Panel does not mount on unrelated pages.
- Current-page capture works.
- Multi-page scan stops at configured limits.
- Pause and stop work during scan.
- Duplicate company and recruiter records are respected.
- Greeting output follows length and evidence constraints.
- Send requires a user click.
- Logs persist after page reload.
- UI has no obvious text overlap at 375px, 768px, 1024px, and desktop widths.

Manual browser verification is required because the target site is dynamic and login-dependent.

## Open Decisions

These can be decided during implementation planning:

- LLM provider: OpenAI-compatible endpoint, Gemini, or local provider.
- First sender implementation: direct chat send versus copy-and-focus fallback.
- Whether to use Vue or React. Current recommendation is WXT + Vue + TypeScript because the reference project and extension patterns are close.
- Exact keyword filters and score threshold defaults.
