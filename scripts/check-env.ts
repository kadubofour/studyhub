// Run before a deploy: npm run check:env   (reads .env.local, then the real environment on top)
// It prints names and what each missing setting turns off, never a value.
import { existsSync, readFileSync } from 'node:fs'

type Env = Record<string, string | undefined>
export type Feature = { name: string; on: boolean; missing: string[]; effect: string }
export type EnvReport = { errors: { name: string; why: string }[]; warnings: string[]; features: Feature[] }

const REQUIRED: [string, string][] = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'the app has no database'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'nobody can sign in'],
  ['NEXT_PUBLIC_SITE_URL', 'email confirmation and reset links, the sitemap and link previews point at the wrong place'],
]
// What each optional group needs, and what the student loses without it
const FEATURES: { name: string; needs: string[]; effect: string }[] = [
  { name: 'AI features', needs: ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], effect: 'summaries, flashcards, quizzes, Scan, PDF structuring, the tutor, topics and resources are unavailable (the server needs the service key to count AI use)' },
  { name: 'Payments (Premium)', needs: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PLAN_MONTHLY', 'PAYSTACK_PLAN_YEARLY', 'SUPABASE_SERVICE_ROLE_KEY'], effect: 'the upgrade screens are hidden and nobody can buy Premium' },
  { name: 'Account deletion', needs: ['SUPABASE_SERVICE_ROLE_KEY'], effect: 'students cannot delete their account from Settings' },
  { name: 'YouTube videos', needs: ['YOUTUBE_API_KEY'], effect: 'topic videos come from the web search instead of YouTube, with no channel or length' },
  { name: 'Contact address on the legal pages', needs: ['NEXT_PUBLIC_SUPPORT_EMAIL'], effect: 'the Terms and Privacy pages show no way to reach you' },
]
// Settings that exist only to point the app at stand-ins for tests; in production they would break or fake real services
const TEST_ONLY = ['E2E_FAKE_AI', 'E2E_FAKE_PAYSTACK', 'OPENAI_BASE_URL', 'PAYSTACK_BASE_URL', 'YOUTUBE_API_BASE']

export function checkEnv(env: Env, mode: 'production' | 'development' = 'production'): EnvReport {
  const set = (n: string) => !!env[n]?.trim()
  const errors = REQUIRED.filter(([n]) => !set(n)).map(([name, why]) => ({ name, why }))
  const features = FEATURES.map(f => {
    const missing = f.needs.filter(n => !set(n))
    return { name: f.name, on: missing.length === 0, missing, effect: f.effect }
  })
  const warnings: string[] = []
  if (mode === 'production') {
    if (set('NEXT_PUBLIC_SITE_URL') && /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SITE_URL!)) warnings.push('NEXT_PUBLIC_SITE_URL points at this computer; confirmation emails would link to localhost.')
    if (set('PAYSTACK_SECRET_KEY') && env.PAYSTACK_SECRET_KEY!.startsWith('sk_test_')) warnings.push('PAYSTACK_SECRET_KEY is a test key; real payments will not work.')
  }
  if (set('SUPABASE_SERVICE_ROLE_KEY') && env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) warnings.push('SUPABASE_SERVICE_ROLE_KEY is the same as the public key; it should be the secret service_role key.')
  if (mode === 'production') for (const n of TEST_ONLY) if (set(n)) warnings.push(`${n} is a test-only setting and should not be set in production.`)
  return { errors, warnings, features }
}

// KEY=value lines; comments, blank lines, quotes and "export " are handled
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return out
}

function main() {
  const mode = process.argv.includes('--dev') ? 'development' : 'production'
  const file = existsSync('.env.local') ? parseEnvFile(readFileSync('.env.local', 'utf8')) : {}
  const env = { ...file, ...process.env }
  const r = checkEnv(env, mode)
  console.log(`Checking settings for ${mode} (${existsSync('.env.local') ? '.env.local plus the environment' : 'the environment only'})\n`)
  for (const f of r.features) console.log(`${f.on ? '  on ' : '  OFF'}  ${f.name}${f.on ? '' : `: missing ${f.missing.join(', ')}. Without it: ${f.effect}.`}`)
  for (const e of r.errors) console.log(`\nMISSING  ${e.name}: ${e.why}.`)
  for (const w of r.warnings) console.log(`\nWARNING  ${w}`)
  console.log(r.errors.length ? '\nNot ready: fix the MISSING items.' : r.warnings.length ? '\nReady, with warnings.' : '\nReady.')
  process.exit(r.errors.length ? 1 : 0)
}

if (process.argv[1] && /check-env\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) main()
