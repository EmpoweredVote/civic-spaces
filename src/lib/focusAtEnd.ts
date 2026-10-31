/** Focus a text field with the caret after its last character — where a chosen prompt landed. */
export function focusAtEnd(field: HTMLTextAreaElement | HTMLInputElement | null) {
  if (!field) return
  // After React commits the new value, or the caret lands at the old end.
  requestAnimationFrame(() => {
    field.focus()
    const end = field.value.length
    field.setSelectionRange(end, end)
  })
}
