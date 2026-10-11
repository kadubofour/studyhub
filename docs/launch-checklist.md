# Studyhub launch checklist

Work top to bottom. Items marked **you** need your accounts; the code side is done. Run `npm run check:env` with your production values in the environment before and after step 2: it lists what is set and what each missing setting turns off.

## 1. Database (Supabase)
- [ ] **you** Create the production project (pick the region closest to your students) and note its URL, anon key and service_role key.
- [ ] **you** Link and push every migration: `npx supabase link --project-ref <ref>`, then `npx supabase db push`. There are 30 migrations (the newest: activity, games, topic resources and its video columns, activity newest-first). Answer yes when it lists them.
- [ ] **you** Authentication, URL configuration: Site URL = your production address; add `https://<your-domain>/auth/callback` to Redirect URLs.
- [ ] **you** Authentication, email: keep "Confirm email" on, and set up **custom SMTP** (Resend, Brevo, SendGrid or similar). The built-in sender is limited to a few emails an hour and is for testing only; sign-up confirmations and password resets will fail for real users without this. Edit the email templates so they say Studyhub.
- [ ] **you** Authentication, providers: the Log in page has "Continue with Google". Either set up Google (Google Cloud OAuth client; redirect URI shown in Supabase) or remove the button before launch.
- [ ] **you** Backups: the free plan has none you can restore. Decide whether to take the paid plan before students put real notes in.
- [ ] **you** Storage: lecture audio is capped at 300 MB per student. Check the plan's storage allowance against how many students you expect (100 students at the cap is 30 GB).

## 2. Hosting (Vercel)
- [ ] **you** Connect the repository; `main` deploys.
- [ ] **you** Environment variables (Production). Names and meaning are in `.env.example`:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `NEXT_PUBLIC_SITE_URL` (your real address), `NEXT_PUBLIC_SUPPORT_EMAIL`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_YEARLY`.
  Never set `E2E_FAKE_AI`, `E2E_FAKE_PAYSTACK`, `OPENAI_BASE_URL`, `PAYSTACK_BASE_URL` or `YOUTUBE_API_BASE` in production; the check warns if you do.
- [ ] **you** Put the Vercel function region next to the Supabase region.
- [ ] **you** The PDF route asks for up to 300 s, the most the Hobby plan allows; very long PDFs may time out there. The Pro plan allows more.
- [ ] **you** Attach your domain. After it is live, set `NEXT_PUBLIC_SITE_URL` to it and redeploy.

## 3. AI (OpenAI)
- [ ] **you** Create the key and **set a monthly spending limit** in the OpenAI dashboard. The app limits each student, but a hard cap protects you.
- [ ] **you** Confirm your account can use the models named in `lib/ai/openai.ts` (`gpt-6-luna`, `gpt-6.1-sol`, `whisper-1`). A model your account cannot reach makes that feature fail with "Couldn't reach the AI".
- [ ] **you** Press **Find resources** on a topic once. Web search has only run against a stand-in so far.

## 4. Videos (YouTube)
- [ ] **you** Google Cloud: enable "YouTube Data API v3", create an API key and restrict it to that API.
- [ ] Know the limit: each topic search costs about 101 of 10,000 free daily units, so about 99 searches a day for the whole app. After that, videos fall back to the web search (the server log says why: `quotaExceeded`). Ask Google for more quota when you near it.

## 5. Payments (Paystack)
- [ ] **you** Finish business verification and switch the account to live mode.
- [ ] **you** Create the monthly and yearly plans; put their codes in `PAYSTACK_PLAN_MONTHLY` and `PAYSTACK_PLAN_YEARLY`. Use the **live** secret key.
- [ ] **you** Set the webhook URL to `https://<your-domain>/api/billing/webhook`.
- [ ] **you** Make one real small payment by card and one by mobile money, check Premium switches on, then turn renewal off in Settings, then refund it.
- [ ] Note: deleting an account also deletes its payment records. If your accounting needs them kept, say so and I will keep an anonymous copy instead.

## 6. Legal and contact
- [ ] **you** Have the **Terms** (`/terms`) and **Privacy** (`/privacy`) pages reviewed by someone qualified. They describe what the app really does, but they are drafts, not legal advice. Fill in the refund wording in the Terms if you want a stated policy.
- [ ] **you** Set `NEXT_PUBLIC_SUPPORT_EMAIL` so students can reach you; both pages then show it.

## 7. Watching it
- [ ] **you** Add an uptime monitor (UptimeRobot, Better Stack, ...) on `https://<your-domain>/api/health`. It answers `{"ok":true}`, or 503 when the database cannot be reached.
- [ ] **you** In Vercel, turn on log alerts or at least read the function logs the first week. Errors are logged there; students see a friendly message.
- [ ] Day one: watch the OpenAI usage page and the Supabase database size.

## 8. Try it on real phones
On an Android phone with Chrome and an iPhone with Safari, with a real email address:
- [ ] Sign up, open the confirmation email, finish onboarding.
- [ ] Add a task, tick it; review a few flashcards; run a focus timer.
- [ ] Record a lecture for two minutes (allow the microphone; try locking the screen) and see the transcript.
- [ ] Scan a page with the camera; upload a PDF, a PowerPoint and a text file.
- [ ] Ask the tutor a question; make a study plan; play both games.
- [ ] Buy Premium with mobile money.
- [ ] Download your data, then delete the test account.

## 9. Right after the deploy
- [ ] Open `/api/health`, `/terms`, `/privacy`, `/robots.txt`.
- [ ] Sign up with a new email and walk the list in step 8 once on the live site.
- [ ] Check the first confirmation email arrived within a minute (SMTP).

## What the code already does
Data download and account deletion in Settings; Terms and Privacy pages; friendly 404 and error pages; security headers (no framing or sniffing, microphone and camera for this site only); search engines kept out of the app; a health check; an environment check; and automated accessibility checks on the main pages in light and dark, Classic and Paper.

## Not done yet, on purpose
A Content-Security-Policy (needs a careful pass over every script, font and image source); an error-reporting service such as Sentry; a cookie banner (only the sign-in cookie is used, which is essential); keeping the original uploaded file.
