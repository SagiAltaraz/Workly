// Closes the dialog a control sits in. The dialog's own close handler then tells the app.
export function closeDialogOf(element: HTMLElement | null): void {
  element?.closest('dialog')?.close()
}
