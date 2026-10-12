# Profile settings, badges, top bar, Classic sidebar and course access

Five requests in one pass.

| Request | Decision |
|---|---|
| "The profile and focus card in Settings should be part of the profile page" | The whole card moves to Profile as a "Preferences" card (time zone, focus goal and lengths, breaks, editor, theme, typed maths, Save). Its Name field goes (Edit profile already has it). Settings keeps Plan, Storage, Appearance, Data, and gets a Sign out button (it lived in the moved form) |
| "The sidebar in Classic has to match the hue of the theme" | Classic's sidebar uses a warm charcoal from Classic's own neutral palette (light: #1F1F1D, dark: #0D0D0C) instead of Vivid's blue-grey; Vivid keeps its own |
| "Take out the badges" | The Badges section, the badge rules, their tests and the e2e checks are removed |
| "Streak indicator in the top bar should be shorter" | Flame and the number only ("🔥 3"), with the full words for screen readers |
| "A period indicator up there too" | Read as class period: a chip with the class on now ("Biology · till 10:30") or the next one today ("Biology · 14:00"), linking to the Planner; nothing when there is no class left today |
| "An easier way to access the course page" | A **Courses** group in the sidebar listing every course (colour dot, name) linking to its page; course chips on Profile open the course page; on phones a Courses entry in the Home banner icons. The list refreshes when a course is added, renamed or deleted |

## Not in this build
Editing courses from the sidebar, reordering courses, a period indicator driven by anything but the timetable.

## Testing
Unit: preferences card (moved tests), profile page without badges, settings page without the form, Classic sidebar CSS, timetable `currentClass`, top bar chips, sidebar courses and refresh. E2E: change focus length on Profile and see it saved; open a course from the sidebar; axe on Profile and Settings.
