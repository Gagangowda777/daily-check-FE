// Status values come from the API in lower case ("present", "pending").
// The UI shows them as labels, so the first letter is capitalised.
export const cap = (value) =>
  typeof value === 'string' && value ? value.charAt(0).toUpperCase() + value.slice(1) : value
