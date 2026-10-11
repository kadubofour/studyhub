import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Terms', description: 'The rules for using Studyhub.' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <section>
        <h2>Using Studyhub</h2>
        <p>Studyhub helps you plan, take notes, review and study. By making an account you agree to these terms and to the <a className="text-accent" href="/privacy">privacy notice</a>. You are responsible for what you do with your account, so keep your password private.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>Your content, meaning the notes, cards, files and recordings you add, stays yours. You allow Studyhub to store it and to process it to run the features you use, including sending it to the AI service when you press an AI button. Only add material you are allowed to use. Record a lecture only where recording is allowed.</p>
      </section>
      <section>
        <h2>AI can be wrong</h2>
        <p>AI answers can be wrong, incomplete or out of date. Summaries, flashcards, quiz questions, transcripts and tutor replies are study aids to check against your own notes and course material, not facts to rely on without checking. Videos and links we suggest belong to other people and we do not control them.</p>
      </section>
      <section>
        <h2>Honest use</h2>
        <p>Use Studyhub to learn. Follow your school&apos;s rules about what help you may use. Do not use it to cheat, to break the law, to harm the service, or to try to get around its limits.</p>
      </section>
      <section>
        <h2>Free and Premium</h2>
        <p>Studyhub is free to use with a daily allowance of AI actions. Premium raises that allowance and is paid through Paystack, in Ghana cedis. A subscription renews until you turn off renewal in <strong>Settings</strong>; you keep Premium until the end of the period you paid for. If something went wrong with a payment, contact us and we will look into it.</p>
      </section>
      <section>
        <h2>Leaving</h2>
        <p>You can download your data and delete your account in <strong>Settings</strong> at any time. Deleting the account is final, and any Premium time you have paid for is lost with no refund for the rest of it. We may suspend an account that breaks these terms or harms others.</p>
      </section>
      <section>
        <h2>No guarantees</h2>
        <p>We work to keep Studyhub running and your work safe, but it is provided as it is, and it may sometimes be unavailable or change. Keep a copy of anything you cannot afford to lose; the download in Settings makes that easy. To the extent the law allows, Studyhub is not responsible for losses from using it.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If these terms change in a way that matters, we will say so in the app. Using Studyhub after a change means you accept it.</p>
      </section>
    </LegalPage>
  )
}
