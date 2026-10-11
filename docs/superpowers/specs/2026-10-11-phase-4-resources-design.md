# Phase 4: Recommended videos and resources

Phase 2 listed "recommended videos and resources" as Phase 4. This adds them per topic, using the topics from U2a.

## 1. Goal
For any topic on Progress, a student can press **Find resources** and get a short list of videos and articles to learn it from, keep the ones that are there, and remove the ones they don't want. Success: after Find resources on a topic, up to 6 links appear (videos first), they are still there after a reload, and a removed one stays gone.

## 2. Decisions made
| Question | Decision |
|---|---|
| Where | Each topic row on Progress gets a Resources button that opens its list |
| Where links come from | OpenAI's built-in web search (no new key). Only links the search actually cited are shown, never links the model wrote itself |
| What is sent | Only the topic name and course name. Never the student's notes |
| Videos | A link to YouTube or Vimeo is labelled Video, everything else Article. Links open in a new tab; Studyhub does not embed or play them |
| Cost | 1 AI action per Find, on the same allowance and speed limit as the other AI tools |
| Saving | Found links are saved to the topic; Find again adds new ones and skips ones already there; a topic keeps at most 20 |
| Not in this build | Resources on notes or Home, ranking by learning style, embedded players, checking that a link still works |

## 3. Data
Migration `20261021000000_topic_resources.sql`: `topic_resources` (id, user_id default auth.uid(), topic_id references topics on delete cascade, url http(s) at most 500 characters, title 1 to 200 characters, kind 'video' or 'article', created_at, unique (topic_id, url)), RLS "own rows" with `owns_topic` on write, and a trigger that refuses a 21st link for a topic.

## 4. The AI call
`POST /api/ai/resources { topicId }` finds the student's own topic (with its course name), asks the model with the web search tool for free, reputable teaching material (videos preferred) for a university student, and returns `{ resources: [{ url, title, kind }] }`. From the answer it keeps only citation annotations whose URL starts with http or https, drops duplicates (same address ignoring a trailing slash, "www." and tracking parameters), puts videos first, keeps 6, and uses the site name when a title is missing. Nothing citable gives the "nothing usable came back" message. The browser saves the results.

## 5. Screen
Under a topic's row: a Resources button (disclosure) opens a list of saved links, each with a Video or Article tag, the site name, and a Remove button; with none yet it says so. A Find resources button (when none) or Find more (otherwise) with "Uses 1 AI action". Failures use the usual AI error message. While finding the button says "Searching…". The topic name stays the only thing shown to the AI.

## 6. Edge cases
| Situation | Behaviour |
|---|---|
| Search finds nothing | "Nothing usable came back"; saved links unchanged |
| A link already saved | Skipped silently |
| Topic deleted or edited away | Its links go with it (cascade) |
| Saving results fails | A note says so; nothing half-saved matters because saving is one insert |
| 20 links already | Find more reports that the topic is full |
| `javascript:` or other non-web address | Never kept |

## 7. Testing
DB: own rows only, constraints (scheme, lengths, kind), uniqueness, the cap, cascade on topic delete. Unit: cleaning (schemes, duplicates, ordering, cap, title fallback), the AI call (tool sent, citations used, empty), the route (sign-in, bad id, not found, cost, success), the component (saved list, find, error, remove, safe link attributes). E2E: draft topics, open Resources, Find, links appear and survive a reload, remove one.

## 8. Build order
1. Migration and DB tests. 2. Cleaning rules and the AI call. 3. Route and fake search for E2E. 4. Data layer and Resources component in Topics. 5. E2E, review, fixes.
