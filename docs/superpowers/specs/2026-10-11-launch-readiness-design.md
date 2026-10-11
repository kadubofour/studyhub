# Launch readiness

An audit of what stands between the app and real students. Some items are code (this build), some need the owner's accounts (the checklist in `docs/launch-checklist.md`).

## 1. What the audit found missing in code
| Gap | Why it matters |
|---|---|
| No way to download or delete your data | Students' notes, lecture transcripts and chats are personal data; privacy rules and common sense say a student can take it out and can leave |
| No Terms or Privacy pages, and nothing says AI providers see content | Needed for payments, for Google and Paystack reviews, and for trust |
| No friendly 404 or error page | A failure shows the framework's bare screen |
| No security headers | Cheap protection against framing and sniffing |
| No robots or page descriptions | Private pages should not be indexed; the landing page should preview well |
| `.env.example` lists a third of the settings; nothing checks them | A deploy with a missing key fails in odd ways (billing off, AI off) with no warning |
| No health endpoint | Nothing for an uptime monitor to watch |
| No automated accessibility check | Contrast and labels were checked by hand, only in places |
| XP stops updating after about 2.7 years of daily activity | The earlier review's one real data-volume limit |

## 2. Decisions made
| Question | Decision |
|---|---|
| Data download | A "Download my data" button in Settings makes one JSON file in the browser from the student's own rows (all tables, not audio files, not billing tokens) |
| Deleting the account | "Delete my account" in Settings, behind a typed confirmation (the word DELETE). A server route turns off Paystack renewal, removes the student's stored files, then deletes the sign-in, and every row goes with it by cascade. It signs the student out |
| Terms and Privacy | Plain-language drafts at `/terms` and `/privacy`, linked from the landing page, sign-up and the footer of Settings. They are drafts for the owner to review with a lawyer; the text says what the app really does |
| Security headers | X-Content-Type-Options, X-Frame-Options (deny), Referrer-Policy, and Permissions-Policy that allows the microphone and camera for the app only. No Content-Security-Policy yet: it needs a careful pass of every script, font and image source |
| Env check | `npm run check:env` reads `.env.local` (or the environment), lists what is set, what is missing and what each missing one turns off; fails only for the settings the app cannot run without |
| Health | `GET /api/health` answers `{ ok: true }` when the app is up and can reach the database, and `{ ok: false }` with 503 when it cannot; it never reveals settings |
| Accessibility | An axe check over the main pages in Classic and Paper, light and dark; serious and critical findings are fixed |

## 3. Data: export
`exportMyData(sb)` reads, page by page, these tables through the student's own session: profiles, courses, classes, tasks, notes, decks, cards, reviews, focus_sessions, quizzes, quiz_attempts, lectures (with transcripts), topics, topic_links, topic_resources, study_plans, study_plan_days, tutor_chats, tutor_messages, game_plays. It returns `{ exported_at, app: "Studyhub", data: { table: rows } }`. If any table fails the whole export fails with a message; a half export is never handed over.

## 4. Data: deletion
`POST /api/account/delete { confirm: "DELETE" }`:
1. Signed in, and the body names the word, else 400 or 401.
2. If a subscription is active, ask Paystack to disable it; if that fails, stop and say so (the student is not left paying for an account that is gone).
3. Remove everything under `<user id>/` in the `imports` and `lectures` buckets.
4. Delete the sign-in with the service role; rows cascade.
5. Clear the session cookies.
Any failure after step 2 reports `delete_failed` and leaves the account usable so the student can retry.

## 5. Out of scope
Content-Security-Policy, error monitoring service, cookie banner (the app sets only the sign-in cookie, which is essential), age checks, data retention schedules, emailing a copy of the export.

## 6. Testing
Unit: export (every table, paging, failure, shape); deletion route (each failure, order of steps, nothing deleted without the word); env check; health; the Settings card; headers; legal pages render; axe over pages. E2E: download starts and contains the student's note; deleting the account signs out and the sign-in no longer works.
