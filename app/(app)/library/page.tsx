import { redirect } from 'next/navigation'

// The Library is now Courses: a bookmarked address still arrives. A course named in it opens that course; the rest is "All material",
// which opens as the Library did (on its notebooks, or on the one list with ?view=all).
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ course?: string; view?: string }> }) {
  const { course, view } = await searchParams
  if (course === 'none') redirect('/courses/none')
  if (course && /^[0-9a-f-]{36}$/i.test(course)) redirect(`/courses/${course}`)
  redirect(view === 'all' ? '/courses?show=material&view=all' : '/courses?show=material')
}
