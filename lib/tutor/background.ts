// A tutor reply is written on the server whether or not the page that asked is still open
/** Ends the reply being written for this chat. The reply carries on without the page, so this is the only way to end it early; it is sent even as the page goes. */
export function stopTutorReply(chatId: string) {
  void fetch('/api/ai/tutor/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId }), keepalive: true }).catch(() => {})
}

// A reply is written whether or not the page is open, so a student who left and came back finds the question still waiting for its answer
export const REPLY_WAIT_MS = 125_000 // a little over what the server allows for one reply
export const awaitingReply = (last: { role: string; created_at: string } | undefined, now = Date.now()) =>
  !!last && last.role === 'user' && last.created_at !== '' && now - Date.parse(last.created_at) < REPLY_WAIT_MS
