import type { CapturedJob } from '@/core/types'

export interface BossPageAdapter {
  captureCurrentPage(): Promise<CapturedJob[]>
  enrichJob(job: CapturedJob): Promise<CapturedJob>
  hasNextPage(): boolean
  goNextPage(): Promise<boolean>
}

export class DomBossAdapter implements BossPageAdapter {
  constructor(private readonly doc: Document = document) {}

  async captureCurrentPage(): Promise<CapturedJob[]> {
    const seen = new Set<string>()
    const jobs: CapturedJob[] = []

    for (const card of this.findJobCards()) {
      const href = this.getJobHref(card)
      const jobId = extractJobId(href)
      if (!jobId || seen.has(jobId)) {
        continue
      }

      seen.add(jobId)
      jobs.push({
        jobId,
        title: findText(card, ['.job-name', '.job-title', '.job-card-left .name', '[class*="job-name"]']),
        company: findText(card, ['.company-name', '.company-text .name', '[class*="company-name"]']),
        salary: findText(card, ['.salary', '.job-salary', '[class*="salary"]']),
        location: findText(card, ['.job-area', '.job-location', '.location', '[class*="area"]']),
        recruiterName: findText(card, ['.boss-name', '.recruiter-name', '[class*="boss-name"]']),
        recruiterTitle: findText(card, ['.boss-title', '.recruiter-title', '[class*="boss-title"]']),
        skills: findTexts(card, ['.tag', '.job-tag', '.tag-list span', '.tags span']),
        welfare: [],
        sourceUrl: resolveUrl(href, this.doc),
      })
    }

    return jobs
  }

  async enrichJob(job: CapturedJob): Promise<CapturedJob> {
    return job
  }

  hasNextPage(): boolean {
    return Boolean(this.findNextPageElement())
  }

  async goNextPage(): Promise<boolean> {
    const next = this.findNextPageElement()
    if (!next) {
      return false
    }

    next.click()
    return true
  }

  private findJobCards(): Element[] {
    const cards = new Set<Element>()
    const selectors = ['.job-card-wrapper', '.job-card-left', 'a[href*="/job_detail/"]']

    for (const selector of selectors) {
      for (const element of this.doc.querySelectorAll(selector)) {
        const card = element.closest('.job-card-wrapper') ?? element.closest('a[href*="/job_detail/"]') ?? element
        cards.add(card)
      }
    }

    return [...cards]
  }

  private getJobHref(card: Element): string {
    if (card.matches('a[href*="/job_detail/"]')) {
      return card.getAttribute('href') || ''
    }

    return card.querySelector('a[href*="/job_detail/"]')?.getAttribute('href') ?? ''
  }

  private findNextPageElement(): HTMLElement | null {
    const selectors = [
      '.next:not(.disabled)',
      '.ui-icon-arrow-right:not(.disabled)',
      '[class*="next"]:not(.disabled)',
      '[class*="arrow-right"]:not(.disabled)',
      'button:not([disabled])',
      'a',
    ]

    for (const selector of selectors) {
      for (const element of this.doc.querySelectorAll<HTMLElement>(selector)) {
        if (isDisabled(element)) {
          continue
        }

        const text = normalizeText(element.textContent)
        const className = element.className.toString()
        const ariaLabel = element.getAttribute('aria-label') ?? ''
        if (
          text.includes('下一页') ||
          text === '>' ||
          className.includes('next') ||
          className.includes('arrow-right') ||
          ariaLabel.includes('下一页')
        ) {
          return element
        }
      }
    }

    return null
  }
}

function extractJobId(href: string): string | null {
  const match = href.match(/\/job_detail\/([^/?#]+?)(?:\.html)?(?:[?#].*)?$/)
  return match?.[1] ?? null
}

function findText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const text = normalizeText(root.querySelector(selector)?.textContent)
    if (text) {
      return text
    }
  }

  return ''
}

function findTexts(root: Element, selectors: string[]): string[] {
  const values = new Set<string>()

  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      const text = normalizeText(element.textContent)
      if (text) {
        values.add(text)
      }
    }
  }

  return [...values]
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function resolveUrl(href: string, doc: Document): string {
  try {
    return new URL(href, doc.location.href).toString()
  } catch {
    return href
  }
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.className.toString().includes('disabled')
  )
}
