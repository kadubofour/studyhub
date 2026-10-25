// Where to draw something that pops up over the app (a message, a question): inside the app's root, which carries the
// student's look and theme, so it wears them too. The first .app-root is the app's own; Settings draws small looks inside it.
export const appRoot = (): Element => document.querySelector('.app-root') ?? document.body
