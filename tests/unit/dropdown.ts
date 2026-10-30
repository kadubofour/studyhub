import { fireEvent, screen, within } from '@testing-library/react'

/** Chooses an option from one of the app's dropdowns, as a person does: open it (by its label), then click the option */
export function choose(label: string | RegExp, option: string | RegExp, root: HTMLElement = document.body) {
  fireEvent.click(within(root).getByRole('button', { name: label }))
  fireEvent.click(within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: option }))
}

/** The option a dropdown shows as chosen, read from its button */
export const shown = (label: string | RegExp, root: HTMLElement = document.body) => within(root).getByRole('button', { name: label }).textContent

/** The options a dropdown offers, in order (it is opened, read and closed) */
export function optionsOf(label: string | RegExp, root: HTMLElement = document.body): string[] {
  const button = within(root).getByRole('button', { name: label })
  fireEvent.click(button)
  const names = within(screen.getByRole('listbox', { name: label })).getAllByRole('option').map(o => o.textContent ?? '')
  fireEvent.click(button)
  return names
}
