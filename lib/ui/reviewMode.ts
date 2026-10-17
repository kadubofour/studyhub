import { localStore, useLocalStore } from '@/lib/ui/localStore'
import { parseReviewMode, type ReviewMode } from '@/lib/ui/answerCheck'

/** How the student answers flashcards: flip the card, or type the answer. Kept on this device. */
export const reviewMode = localStore<ReviewMode>('studyhub.review.mode', 'flip', parseReviewMode)
export const useReviewMode = () => useLocalStore(reviewMode)
