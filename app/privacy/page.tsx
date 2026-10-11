import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Privacy', description: 'What Studyhub keeps, who else handles it, and how to take it out or delete it.' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <section>
        <h2>What we keep</h2>
        <ul>
          <li>Your account: your email, your name and your settings.</li>
          <li>What you add: notes, flashcards, tasks and classes, quizzes and your answers, lecture recordings and their transcripts, uploaded files, tutor chats, study plans, topics and saved links.</li>
          <li>What you do: reviews, focus sessions and game plays. Your XP, level and streak are worked out from these.</li>
          <li>Payments: if you buy Premium, the payment reference, the amount, how you paid, and the card brand and last four digits. We never see or store your full card or mobile money details; Paystack handles them.</li>
        </ul>
      </section>
      <section>
        <h2>Who else handles it</h2>
        <p>Studyhub is built on services that process data for us:</p>
        <ul>
          <li><strong>Supabase</strong> stores your account and everything above, and signs you in.</li>
          <li><strong>Vercel</strong> hosts the app.</li>
          <li><strong>Your browser</strong> may do the speech recognition for the free live transcript while you record. In Chrome that means your browser sends the audio to Google, and in Safari to Apple, under their terms. The more accurate transcript made afterwards uses OpenAI instead.</li>
          <li><strong>OpenAI</strong> reads the text, images, PDFs or audio you send when you use an AI feature: summaries, flashcards, quizzes, Scan, PDF import, lecture transcripts, topics and the tutor. It is sent only when you press the button, and its own terms and privacy policy apply to what it receives. Finding resources sends only the name of a topic and its course to OpenAI&apos;s web search, never your notes.</li>
          <li><strong>YouTube</strong> (Google) receives the topic and course name when we look for videos.</li>
          <li><strong>Paystack</strong> processes payments.</li>
          <li><strong>Google</strong> signs you in, only if you choose Continue with Google.</li>
        </ul>
        <p>We do not sell your data and we show no advertising.</p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>Studyhub uses only the cookies and browser storage it needs to work: staying signed in, remembering your theme and sidebar, and keeping an unsaved lecture recording on your device until you save it. There are no advertising or tracking cookies and no analytics from other companies.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>In <strong>Settings</strong> you can download everything in your account as one file. Lecture audio is not in that file.</li>
          <li>In <strong>Settings</strong> you can delete your account. That removes your sign-in, everything in it, your lecture audio and uploaded files, and turns off any subscription renewal. It cannot be undone.</li>
          <li>You can delete single notes, decks, lectures and chats at any time.</li>
        </ul>
        <p>When an account is deleted its payment records are deleted with it. Deleting removes the data from Studyhub straight away; copies in our providers&apos; backups disappear when those backups expire. A recording not yet saved is kept in your browser, so clear your browser&apos;s site data on a shared device.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Other students cannot see your data; the database only lets your signed-in account read your own rows. The people who run Studyhub can read stored data when they need to keep the service working, and what you send to an AI feature goes to that provider as described above. Connections to Studyhub are encrypted. No service is perfectly safe, so keep your password private and use a different one here than elsewhere.</p>
      </section>
      <section>
        <h2>Children</h2>
        <p>Studyhub is made for students. If you are young enough that you need a parent&apos;s permission to use online services where you live, please ask them first.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If this page changes in a way that matters, we will say so in the app. The date at the top shows when it last changed.</p>
      </section>
    </LegalPage>
  )
}
