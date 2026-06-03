export function compactText(value: string | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function firstNonEmpty(values: Array<string | undefined>): string {
  return values.map(compactText).find(Boolean) ?? ''
}

export function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((keyword) => keyword && lower.includes(keyword.toLowerCase()))
}

export function trimToLength(text: string, maxLength: number): string {
  const value = compactText(text)
  return value.length <= maxLength ? value : value.slice(0, maxLength - 1)
}
