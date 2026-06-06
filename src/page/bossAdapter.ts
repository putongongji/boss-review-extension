import type { CapturedJob, GreetOutcome } from '@/core/types'
import { sleep } from '@/utils/delay'

export interface BossPageAdapter {
  captureCurrentPage(): Promise<CapturedJob[]>
  enrichJob(job: CapturedJob, options?: { focus?: boolean }): Promise<CapturedJob>
  hasNextPage(): boolean
  goNextPage(): Promise<boolean>
}

export interface DomBossAdapterOptions {
  pageTransitionTimeoutMs?: number
  pageTransitionPollMs?: number
  emptyListWaitMs?: number
  detailTransitionTimeoutMs?: number
  detailTransitionPollMs?: number
}

interface PageSignature {
  firstJobId: string | null
  content: string
}

interface JobUrlParts {
  jobId: string
  securityId: string
  lid: string
}

interface PageBridgeResponse<T> {
  type?: string
  requestId?: string
  ok?: boolean
  payload?: T
  error?: string
}

const DEFAULT_PAGE_TRANSITION_TIMEOUT_MS = 5000
const DEFAULT_PAGE_TRANSITION_POLL_MS = 100
const DEFAULT_EMPTY_LIST_WAIT_MS = 250
const DEFAULT_DETAIL_TRANSITION_TIMEOUT_MS = 3000
const DEFAULT_DETAIL_TRANSITION_POLL_MS = 100
const DEFAULT_CUSTOM_GREETING_DELAY_MS = 3000
const CUSTOM_GREETING_SEND_TIMEOUT_MS = 35000

export class DomBossAdapter implements BossPageAdapter {
  constructor(
    private readonly doc: Document = document,
    private readonly options: DomBossAdapterOptions = {},
  ) {}

  async captureCurrentPage(): Promise<CapturedJob[]> {
    const vueJobs = await requestVueJobs(this.doc).catch(() => [])
    if (vueJobs.length > 0) {
      return vueJobs
    }

    const seen = new Set<string>()
    const jobs: CapturedJob[] = []

    for (const card of this.findJobCards()) {
      const href = this.getJobHref(card)
      const urlParts = mergeJobUrlParts(
        extractJobUrlParts(href, this.doc),
        findJobUrlPartsInElement(card, this.doc, extractJobId(href) ?? ''),
      )
      if (!urlParts || seen.has(urlParts.jobId)) {
        continue
      }

      const tags = findTexts(card, ['.tag', '.job-tag', '.tag-list span', '.tags span'])
      seen.add(urlParts.jobId)
      jobs.push({
        jobId: urlParts.jobId,
        securityId: urlParts.securityId,
        lid: urlParts.lid,
        title: findText(card, ['.job-name', '.job-title', '.job-card-left .name', '[class*="job-name"]']),
        company: findText(card, ['.company-name', '.company-text .name', '[class*="company-name"]']),
        salary: findText(card, ['.salary', '.job-salary', '[class*="salary"]']),
        location: findListLocation(card),
        experience: pickExperience(tags),
        degree: pickDegree(tags),
        recruiterName: findText(card, ['.boss-name', '.recruiter-name', '[class*="boss-name"]']),
        recruiterTitle: findText(card, ['.boss-title', '.recruiter-title', '[class*="boss-title"]']),
        recruiterId: findRecruiterId(card),
        encryptBossId: findRecruiterId(card),
        skills: tags.filter((tag) => tag !== pickExperience(tags) && tag !== pickDegree(tags)),
        welfare: [],
        sourceUrl: resolveUrl(href, this.doc),
      })
    }

    return jobs
  }

  async enrichJob(job: CapturedJob, options: { focus?: boolean } = {}): Promise<CapturedJob> {
    if (options.focus) {
      const vueDetail = await requestVueDetail(this.doc, job.jobId).catch(() => null)
      if (vueDetail) {
        return {
          ...job,
          ...vueDetail,
        }
      }
      await this.focusJobDetail(job)
    }

    const detail = this.parseDetailPanel()
    if (!detailMatchesJob(job, detail)) {
      return job
    }

    return {
      ...job,
      ...detail,
    }
  }

  async greetJob(job: CapturedJob, options: { customMessage?: string; sendCustomMessage?: boolean } = {}): Promise<GreetOutcome> {
    await sendFriendAddRequest(job, this.doc)
    const customGreetingContent = options.customMessage?.trim() ?? ''
    const outcome: GreetOutcome = {
      defaultGreetingSent: true,
      defaultGreetingContent: 'Boss 默认招呼语',
      customGreetingEnabled: Boolean(options.sendCustomMessage),
      customGreetingContent,
      customGreetingSent: false,
      resultMessage: '已后台打招呼，使用 Boss 默认招呼语',
    }

    if (!options.sendCustomMessage || !customGreetingContent) {
      return outcome
    }

    await sleep(DEFAULT_CUSTOM_GREETING_DELAY_MS)
    try {
      const detail = await sendCustomGreetingRequest(job, customGreetingContent, this.doc)
      outcome.customGreetingSent = true
      outcome.detail = detail
      outcome.resultMessage = `已后台打招呼，并已发送自定义内容${detail}`
    } catch (error) {
      outcome.customGreetingError = error instanceof Error ? error.message : '自定义内容发送失败'
      outcome.resultMessage = `已后台打招呼；自定义内容未发送：${outcome.customGreetingError}`
    }

    return outcome
  }

  getJobIdFromElement(target: EventTarget | null): string {
    if (!(target instanceof Element)) return ''

    const card =
      target.closest('.job-card-wrapper') ??
      target.closest('.job-card-box') ??
      target.closest('.job-list-card') ??
      target.closest('.job-card-left') ??
      target.closest('a[href*="/job_detail/"]')
    if (!card) return ''

    return extractJobId(this.getJobHref(card)) ?? ''
  }

  hasNextPage(): boolean {
    return Boolean(this.findNextPageElement())
  }

  async goNextPage(): Promise<boolean> {
    const next = this.findNextPageElement()
    if (!next) {
      return false
    }

    const before = this.getPageSignature()
    next.click()
    return this.waitForPageTransition(before)
  }

  private async waitForPageTransition(before: PageSignature): Promise<boolean> {
    if (!before.firstJobId) {
      await sleep(this.options.emptyListWaitMs ?? DEFAULT_EMPTY_LIST_WAIT_MS)
      return true
    }

    const timeoutMs = this.options.pageTransitionTimeoutMs ?? DEFAULT_PAGE_TRANSITION_TIMEOUT_MS
    const pollMs = this.options.pageTransitionPollMs ?? DEFAULT_PAGE_TRANSITION_POLL_MS
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      await sleep(pollMs)
      const current = this.getPageSignature()
      if (current.firstJobId && current.firstJobId !== before.firstJobId) {
        return true
      }
      if (current.content && current.content !== before.content) {
        return true
      }
    }

    return false
  }

  private getPageSignature(): PageSignature {
    const cards = this.findJobCards()
    const firstJobId = extractJobId(cards[0] ? this.getJobHref(cards[0]) : '') ?? null
    const content = cards.map((card) => `${this.getJobHref(card)} ${normalizeText(card.textContent)}`).join('\n')

    return { firstJobId, content }
  }

  private findJobCards(): Element[] {
    const cards = new Set<Element>()
    const selectors = [
      '.job-card-wrapper',
      '.job-card-left',
      '.job-card-box',
      '.job-list-card',
      'a[href*="/job_detail/"]',
    ]

    for (const selector of selectors) {
      for (const element of this.doc.querySelectorAll(selector)) {
        const card =
          element.closest('.job-card-wrapper') ??
          element.closest('.job-card-box') ??
          element.closest('.job-list-card') ??
          element.closest('.job-card-left') ??
          element.closest('a[href*="/job_detail/"]') ??
          element
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

  private findJobCardById(jobId: string): Element | null {
    return this.findJobCards().find((card) => extractJobId(this.getJobHref(card)) === jobId) ?? null
  }

  private getClickableJobElement(card: Element): HTMLElement | null {
    if (card.matches('a[href*="/job_detail/"]') && card instanceof HTMLElement) {
      return card
    }

    return card.querySelector<HTMLElement>('a[href*="/job_detail/"]') ?? (card instanceof HTMLElement ? card : null)
  }

  private async focusJobDetail(job: CapturedJob): Promise<void> {
    const detailPanel = this.findDetailPanel()
    if (!detailPanel) {
      throw new Error('当前页面没有岗位详情面板，请进入 Boss 职位列表页后再读取 JD')
    }

    if (this.extractDetailJobId(detailPanel) === job.jobId) {
      return
    }

    const card = this.findJobCardById(job.jobId)
    if (!card) {
      throw new Error('当前 Boss 页面找不到这个岗位，请回到所在列表页或重新扫描当前页')
    }

    const clickable = this.getClickableJobElement(card)
    if (!clickable) {
      throw new Error('当前 Boss 页面找不到岗位链接')
    }

    card instanceof HTMLElement
      ? card.scrollIntoView?.({ block: 'center', inline: 'nearest' })
      : clickable.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    clickable.click()
    const matched = await this.waitForDetailJob(job.jobId)
    if (!matched) {
      throw new Error('未读取到该岗位详情，请在 Boss 页面手动点中后再刷新')
    }
  }

  private async waitForDetailJob(jobId: string): Promise<boolean> {
    if (this.extractDetailJobId(this.findDetailPanel() ?? this.doc.body) === jobId) {
      return true
    }

    const timeoutMs = this.options.detailTransitionTimeoutMs ?? DEFAULT_DETAIL_TRANSITION_TIMEOUT_MS
    const pollMs = this.options.detailTransitionPollMs ?? DEFAULT_DETAIL_TRANSITION_POLL_MS
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      await sleep(pollMs)
      const detailJobId = this.extractDetailJobId(this.findDetailPanel() ?? this.doc.body)
      if (detailJobId === jobId) {
        return true
      }
    }

    return false
  }

  private parseDetailPanel(): Partial<CapturedJob> {
    const detail = this.findDetailPanel()
    if (!detail) {
      return {}
    }

    const tags = findTexts(detail, ['.job-detail-header .tag-list li'])
    const bossAttr = findText(detail, ['.job-boss-info .boss-info-attr'])
    const [companyFromBoss, recruiterTitle] = splitBossAttribute(bossAttr)

    return compactJobPatch({
      jobId: this.extractDetailJobId(detail),
      title: findText(detail, ['.job-detail-info .job-name', '.job-name']),
      company: companyFromBoss || findText(detail, ['.company-name']),
      salary: findText(detail, ['.job-detail-info .job-salary', '.job-salary']),
      location: tags[0],
      workAddress: findText(detail, [
        '.location-address',
        '.job-address',
        '.job-location-address',
        '.job-detail-address',
        '[class*="address"]',
      ]),
      experience: tags[1],
      degree: tags[2],
      recruiterName: cleanRecruiterName(findText(detail, ['.job-boss-info .name', '.boss-name'])),
      recruiterTitle,
      jdText: cleanJdText(readMultilineElementText(this.findJdElement(detail))),
    })
  }

  private findDetailPanel(): Element | null {
    return this.doc.querySelector('.job-detail-box') ?? this.doc.querySelector('.job-detail-container')
  }

  private findJdElement(detail: Element): Element | null {
    return detail.querySelector('.job-detail-body .desc') ?? detail.querySelector('.desc') ?? detail.querySelector('.job-detail-body')
  }

  private extractDetailJobId(detail: Element): string {
    for (const link of detail.querySelectorAll('a[href*="/job_detail/"]')) {
      const jobId = extractJobId(link.getAttribute('href') ?? '')
      if (jobId) {
        return jobId
      }
    }

    for (const element of detail.querySelectorAll('[ka]')) {
      const lastPart = (element.getAttribute('ka') ?? '').split('_').pop() ?? ''
      if (/^[A-Za-z0-9-]{20,}$/.test(lastPart)) {
        return lastPart
      }
    }

    return ''
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

function extractJobUrlParts(href: string, doc: Document): JobUrlParts | null {
  try {
    const url = new URL(href, doc.location.href)
    const jobId = extractJobId(url.toString()) ?? ''
    if (!jobId) return null

    return {
      jobId,
      securityId: url.searchParams.get('securityId') ?? '',
      lid: url.searchParams.get('lid') ?? '',
    }
  } catch {
    const jobId = extractJobId(href) ?? ''
    return jobId ? { jobId, securityId: '', lid: '' } : null
  }
}

function extractFriendAddUrlParts(href: string, doc: Document): JobUrlParts | null {
  if (!href) return null

  try {
    const url = new URL(href, doc.location.href)
    const jobId = url.searchParams.get('jobId') || extractJobId(url.toString()) || ''
    if (!jobId) return null

    return {
      jobId,
      securityId: url.searchParams.get('securityId') ?? '',
      lid: url.searchParams.get('lid') ?? '',
    }
  } catch {
    return null
  }
}

function mergeJobUrlParts(left: JobUrlParts | null, right: JobUrlParts | null): JobUrlParts | null {
  if (!left) return right
  if (!right) return left
  if (left.jobId !== right.jobId) return left

  return {
    jobId: left.jobId,
    securityId: left.securityId || right.securityId,
    lid: left.lid || right.lid,
  }
}

function findJobUrlPartsInElement(root: Element, doc: Document, preferredJobId: string): JobUrlParts | null {
  let found: JobUrlParts | null = null
  for (const value of collectAttributeValues(root)) {
    found = mergeJobUrlParts(found, extractAnyJobUrlParts(value, doc, preferredJobId))
  }

  return found
}

function findJobUrlPartsInPage(doc: Document, preferredJobId: string): JobUrlParts | null {
  let found: JobUrlParts | null = null
  for (const value of collectPageCandidateValues(doc, preferredJobId)) {
    found = mergeJobUrlParts(found, extractAnyJobUrlParts(value, doc, preferredJobId))
  }

  return found
}

function extractAnyJobUrlParts(value: string, doc: Document, preferredJobId: string): JobUrlParts | null {
  const decodedValues = Array.from(new Set([value, safeDecode(value)]))
  let found: JobUrlParts | null = null
  for (const raw of decodedValues) {
    found = mergeJobUrlParts(found, extractJobUrlParts(raw, doc))
    found = mergeJobUrlParts(found, extractFriendAddUrlParts(raw, doc))
    found = mergeJobUrlParts(found, extractInlineJobParts(raw, preferredJobId))
  }

  return found
}

function extractInlineJobParts(value: string, preferredJobId: string): JobUrlParts | null {
  if (!preferredJobId || !value.includes(preferredJobId)) return null

  const securityId =
    findNearbyParam(value, preferredJobId, /securityId["'=:\s]+([^"',&\s}]+)/) ||
    findNearbyParam(value, preferredJobId, /securityId=([^&"'\s]+)/)
  const lid =
    findNearbyParam(value, preferredJobId, /lid["'=:\s]+([^"',&\s}]+)/) ||
    findNearbyParam(value, preferredJobId, /lid=([^&"'\s]+)/)

  return securityId || lid ? { jobId: preferredJobId, securityId, lid } : null
}

function findNearbyParam(value: string, needle: string, pattern: RegExp): string {
  const index = value.indexOf(needle)
  if (index < 0) return ''

  const nearby = value.slice(Math.max(0, index - 800), index + needle.length + 800)
  return nearby.match(pattern)?.[1] ?? ''
}

function collectAttributeValues(root: Element): string[] {
  const values: string[] = []
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attr of element.attributes) {
      if (attr.value) {
        values.push(attr.value)
      }
    }
  }

  return values
}

function collectPageCandidateValues(doc: Document, preferredJobId: string): string[] {
  const values: string[] = []
  for (const element of doc.querySelectorAll('[href], [data-url], [redirect-url], [ka]')) {
    for (const attr of element.attributes) {
      const value = attr.value
      if (value.includes(preferredJobId) || value.includes('securityId') || value.includes('/wapi/zpgeek/friend/add.json')) {
        values.push(value)
      }
    }
  }
  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent ?? ''
    if (text.includes(preferredJobId) && text.includes('securityId')) {
      values.push(text)
    }
  }

  return values
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function findText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    if (root.matches(selector)) {
      const rootText = readElementText(root)
      if (rootText) {
        return rootText
      }
    }

    const text = readElementText(root.querySelector(selector))
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
      const text = readElementText(element)
      if (text) {
        values.add(text)
      }
    }
  }

  return [...values]
}

function findListLocation(card: Element): string {
  const location = findText(card, [
    '.job-area',
    '.job-area-wrapper',
    '.job-location',
    '.location',
    '[class*="area"]',
    '[class*="location"]',
    '[class*="address"]',
  ])
  if (location) {
    return location
  }

  const text = readElementText(card)
  const match = text.match(/[\u4e00-\u9fa5]{2,}(?:[·\s]+[\u4e00-\u9fa5]{2,}){1,3}/)
  return match?.[0] ?? ''
}

function findRecruiterId(card: Element): string {
  const explicitAttr =
    card.querySelector('[data-boss-id], [data-encrypt-boss-id], [data-encrypt-user-id]') ??
    (card.hasAttribute('data-boss-id') || card.hasAttribute('data-encrypt-boss-id') || card.hasAttribute('data-encrypt-user-id')
      ? card
      : null)
  const explicitValue =
    explicitAttr?.getAttribute('data-boss-id') ??
    explicitAttr?.getAttribute('data-encrypt-boss-id') ??
    explicitAttr?.getAttribute('data-encrypt-user-id') ??
    ''
  if (explicitValue) {
    return explicitValue
  }

  for (const value of collectAttributeValues(card)) {
    const decoded = safeDecode(value)
    const match =
      decoded.match(/encrypt(?:Boss|User)Id["'=:\s]+([^"',&\s}]+)/) ??
      decoded.match(/bossId["'=:\s]+([^"',&\s}]+)/) ??
      decoded.match(/encrypt(?:Boss|User)Id=([^&"'\s]+)/) ??
      decoded.match(/bossId=([^&"'\s]+)/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}

function normalizeText(value: string | null | undefined): string {
  return decodeBossDigits(value ?? '').replace(/\s+/g, ' ').trim()
}

function readElementText(element: Element | null | undefined): string {
  if (!element) {
    return ''
  }

  const clone = element.cloneNode(true) as Element
  for (const child of clone.querySelectorAll('script, style, [hidden]')) {
    child.remove()
  }
  for (const child of clone.querySelectorAll<HTMLElement>('*')) {
    const style = child.getAttribute('style') ?? ''
    if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(style)) {
      child.remove()
    }
  }

  return normalizeText(clone.textContent)
}

function readMultilineElementText(element: Element | null | undefined): string {
  if (!element) {
    return ''
  }

  const clone = element.cloneNode(true) as Element
  for (const child of clone.querySelectorAll('script, style, [hidden]')) {
    child.remove()
  }
  for (const child of clone.querySelectorAll<HTMLElement>('*')) {
    const style = child.getAttribute('style') ?? ''
    if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(style)) {
      child.remove()
    }
  }

  return normalizeMultilineText((clone as HTMLElement).innerText || clone.textContent)
}

function cleanJdText(text: string): string {
  return normalizeMultilineText(
    text
      .replace(/来自BOSS直聘/g, '')
      .replace(/BOSS直聘/g, '')
      .replace(/\bboss\b/gi, '')
      .replace(/\bkanzhun\b/gi, ''),
  )
}

function decodeBossDigits(text: string): string {
  return text.replace(/[\uE031-\uE03A]/g, (char) => String(char.charCodeAt(0) - 0xe031))
}

function cleanRecruiterName(text: string): string {
  return normalizeText(text.replace(/在线/g, ''))
}

function splitBossAttribute(text: string): [string, string] {
  const parts = text.split(/[·|｜]/).map((part) => normalizeText(part)).filter(Boolean)
  return [parts[0] ?? '', parts[1] ?? '']
}

function pickExperience(tags: string[]): string {
  return tags.find((tag) => /经验|年|应届|在校|不限/.test(tag)) ?? ''
}

function pickDegree(tags: string[]): string {
  return tags.find((tag) => /博士|硕士|本科|大专|中专|高中|学历不限|不限/.test(tag)) ?? ''
}

function detailMatchesJob(job: CapturedJob, detail: Partial<CapturedJob>): boolean {
  if (detail.jobId) {
    return job.jobId === detail.jobId
  }

  if (!detail.title) {
    return false
  }
  if (!job.title) {
    return false
  }

  const jobTitle = normalizeText(job.title)
  const detailTitle = normalizeText(detail.title)
  return jobTitle === detailTitle || jobTitle.includes(detailTitle) || detailTitle.includes(jobTitle)
}

function compactJobPatch(patch: Partial<CapturedJob>): Partial<CapturedJob> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return Boolean(value)
  })) as Partial<CapturedJob>
}

function normalizeMultilineText(value: string | null | undefined): string {
  return decodeBossDigits(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

async function requestVueJobs(doc: Document): Promise<CapturedJob[]> {
  if (!isPageBridgeReady(doc)) {
    return []
  }

  const jobs = await requestPageBridge<Partial<CapturedJob>[]>('BRS_GET_VUE_JOBS')
  return Array.isArray(jobs) ? jobs.map((job) => normalizeBridgeJob(job, doc)).filter((job) => Boolean(job.jobId)) : []
}

async function requestVueDetail(doc: Document, jobId: string): Promise<Partial<CapturedJob> | null> {
  if (!isPageBridgeReady(doc)) {
    return null
  }

  const detail = await requestPageBridge<Partial<CapturedJob>>('BRS_GET_VUE_DETAIL', { jobId })
  return detail?.jobId ? normalizeBridgeJob(detail, doc) : null
}

function isPageBridgeReady(doc: Document): boolean {
  return doc.documentElement.getAttribute('data-boss-review-bridge') === 'ready'
}

function normalizeBridgeJob(job: Partial<CapturedJob>, doc: Document): CapturedJob {
  return {
    jobId: String(job.jobId ?? ''),
    securityId: job.securityId,
    lid: job.lid,
    title: job.title ?? '',
    company: job.company ?? '',
    salary: job.salary,
    location: job.location,
    workAddress: job.workAddress,
    experience: job.experience,
    degree: job.degree,
    recruiterName: job.recruiterName,
    recruiterTitle: job.recruiterTitle,
    recruiterId: job.recruiterId,
    encryptBossId: job.encryptBossId,
    companyId: job.companyId,
    activeText: job.activeText,
    skills: Array.isArray(job.skills) ? job.skills : [],
    welfare: Array.isArray(job.welfare) ? job.welfare : [],
    jdText: job.jdText,
    sourceUrl: resolveUrl(job.sourceUrl ?? `/job_detail/${job.jobId ?? ''}.html`, doc),
  }
}

function requestPageBridge<T>(type: 'BRS_GET_VUE_JOBS' | 'BRS_GET_VUE_DETAIL', payload: Record<string, unknown> = {}): Promise<T> {
  const requestId = `brs-${Date.now()}-${Math.random().toString(36).slice(2)}`

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('Boss 页面桥响应超时'))
    }, 1200)
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as PageBridgeResponse<T>
      if (data.type !== 'BRS_PAGE_BRIDGE_RESULT' || data.requestId !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
      if (data.ok) {
        resolve(data.payload as T)
      } else {
        reject(new Error(data.error || 'Boss 页面桥读取失败'))
      }
    }

    window.addEventListener('message', handleMessage)
    window.postMessage({ type, requestId, ...payload }, '*')
  })
}

async function sendFriendAddRequest(job: CapturedJob, doc: Document): Promise<void> {
  const sourceParts = extractJobUrlParts(job.sourceUrl, doc)
  const fallbackParts = findJobUrlPartsInPage(doc, job.jobId)
  const securityId = job.securityId || sourceParts?.securityId || fallbackParts?.securityId || ''
  if (!securityId) {
    throw new Error(
      `后台打招呼缺少 securityId：岗位 ${job.jobId} 的列表链接、详情区域和页面脚本里都没有找到 Boss 接口参数。已找到 lid=${job.lid || sourceParts?.lid || fallbackParts?.lid || '无'}。请刷新当前 Boss 列表后重新扫描；如果仍失败，把当前页面截图发我，我会按实际 DOM 补解析。`,
    )
  }

  const token = getCookie('bst', doc)
  if (!token) {
    throw new Error('没有获取到 Boss token，请刷新页面后重试')
  }

  const url = new URL('https://www.zhipin.com/wapi/zpgeek/friend/add.json')
  url.searchParams.set('securityId', securityId)
  url.searchParams.set('jobId', job.jobId)
  const lid = job.lid || sourceParts?.lid || fallbackParts?.lid || ''
  if (lid) {
    url.searchParams.set('lid', lid)
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { Zp_token: token },
  })
  const data = (await response.json().catch(() => null)) as {
    code?: number
    message?: string
    zpData?: { bizData?: { chatRemindDialog?: { content?: string } } }
  } | null

  if (!response.ok) {
    throw new Error(`后台打招呼失败：${response.status}`)
  }
  if (data?.code === 0) {
    return
  }

  const message = data?.zpData?.bizData?.chatRemindDialog?.content || data?.message || '未知错误'
  throw new Error(`后台打招呼失败：${message}`)
}

async function sendCustomGreetingRequest(job: CapturedJob, content: string, doc: Document): Promise<string> {
  const sourceParts = extractJobUrlParts(job.sourceUrl, doc)
  const fallbackParts = findJobUrlPartsInPage(doc, job.jobId)
  let securityId = job.securityId || sourceParts?.securityId || fallbackParts?.securityId || ''
  let lid = job.lid || sourceParts?.lid || fallbackParts?.lid || ''
  let bossId = job.encryptBossId || job.recruiterId || findBossIdInPage(doc, job.jobId)

  if (!bossId || !lid || !securityId) {
    const vueDetail = await requestVueDetail(doc, job.jobId).catch(() => null)
    securityId = securityId || vueDetail?.securityId || ''
    lid = lid || vueDetail?.lid || ''
    bossId = bossId || vueDetail?.encryptBossId || vueDetail?.recruiterId || ''
  }

  if (!securityId) {
    throw new Error(`自定义内容未发送：缺少 securityId，岗位 ${job.jobId} 不能换取聊天参数`)
  }
  if (!bossId && lid) {
    bossId = await requestDetailBossId({ securityId, lid }, doc)
  }
  if (!bossId) {
    throw new Error(`自定义内容未发送：缺少 Boss 加密 ID，已找到 securityId=${securityId ? '有' : '无'}，lid=${lid || '无'}。请刷新 Boss 列表后重新扫描`)
  }

  const bossData = await requestBossData({ securityId, bossId }, doc)
  const detail = await sendCustomGreetingThroughPage({
    toUid: String(bossData.bossId ?? ''),
    toName: String(bossData.encryptBossId ?? ''),
    content,
  })
  return detail
}

async function requestDetailBossId(params: { securityId: string; lid: string }, doc: Document): Promise<string> {
  const token = getCookie('bst', doc)
  if (!token) {
    throw new Error('没有获取到 Boss token')
  }

  const url = new URL('https://www.zhipin.com/wapi/zpgeek/job/detail.json')
  url.searchParams.set('securityId', params.securityId)
  url.searchParams.set('lid', params.lid)
  url.searchParams.set('_', String(Date.now()))
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Zp_token: token },
  })
  const data = (await response.json().catch(() => null)) as {
    code?: number
    message?: string
    zpData?: {
      jobInfo?: { encryptUserId?: string; encryptBossId?: string; bossId?: string | number }
      bossInfo?: { encryptUserId?: string; encryptBossId?: string; bossId?: string | number }
    }
  } | null

  if (!response.ok) {
    throw new Error(`读取岗位详情接口失败：${response.status}`)
  }
  if (data?.code !== 0) {
    throw new Error(`读取岗位详情接口失败：${data?.message ?? '未知错误'}`)
  }

  const detailBossId =
    data.zpData?.jobInfo?.encryptUserId ??
    data.zpData?.jobInfo?.encryptBossId ??
    data.zpData?.jobInfo?.bossId ??
    data.zpData?.bossInfo?.encryptUserId ??
    data.zpData?.bossInfo?.encryptBossId ??
    data.zpData?.bossInfo?.bossId ??
    ''
  return String(detailBossId)
}

async function requestBossData(params: { securityId: string; bossId: string }, doc: Document): Promise<{ bossId?: string | number; encryptBossId?: string }> {
  const token = getCookie('bst', doc)
  if (!token) {
    throw new Error('没有获取到 Boss token')
  }

  const body = new FormData()
  body.append('bossId', params.bossId)
  body.append('securityId', params.securityId)
  body.append('bossSrc', '0')
  const response = await fetch('https://www.zhipin.com/wapi/zpchat/geek/getBossData', {
    method: 'POST',
    headers: { Zp_token: token },
    body,
  })
  const data = (await response.json().catch(() => null)) as {
    code?: number
    message?: string
    zpData?: { data?: { bossId?: string | number; encryptBossId?: string } }
  } | null

  if (!response.ok) {
    throw new Error(`获取 BossData 失败：${response.status}`)
  }
  if (data?.code !== 0) {
    throw new Error(`获取 BossData 失败：${data?.message ?? '未知错误'}`)
  }
  const bossData = data.zpData?.data ?? {}
  if (!bossData.bossId || !bossData.encryptBossId) {
    throw new Error('BossData 缺少聊天对象 ID')
  }

  return bossData
}

function sendCustomGreetingThroughPage(input: { toUid: string; toName: string; content: string }): Promise<string> {
  const requestId = `brs-${Date.now()}-${Math.random().toString(36).slice(2)}`
  console.log('[Boss助手] 发送自定义消息请求到页面桥:', requestId)

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      console.error('[Boss助手] 自定义消息响应超时:', requestId)
      reject(new Error('自定义消息发送超时'))
    }, CUSTOM_GREETING_SEND_TIMEOUT_MS)
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string; ok?: boolean; error?: string; detail?: string }
      if (data.type !== 'BRS_SEND_CUSTOM_GREETING_RESULT' || data.requestId !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
      const detail = data.detail ? `｜${data.detail}` : ''
      if (data.ok) {
        console.log('[Boss助手] 自定义消息发送成功:', requestId, detail)
        resolve(detail)
      } else {
        console.error('[Boss助手] 自定义消息发送失败:', data.error || '无具体错误', detail)
        reject(new Error(`${data.error || '自定义消息发送失败'}${detail}`))
      }
    }

    window.addEventListener('message', handleMessage)
    window.postMessage({ type: 'BRS_SEND_CUSTOM_GREETING', requestId, ...input }, '*')
  })
}

function findBossIdInPage(doc: Document, jobId: string): string {
  for (const value of collectPageCandidateValues(doc, jobId)) {
    const decoded = safeDecode(value)
    const match =
      decoded.match(/encrypt(?:Boss|User)Id["'=:\s]+([^"',&\s}]+)/) ??
      decoded.match(/bossId["'=:\s]+([^"',&\s}]+)/) ??
      decoded.match(/encrypt(?:Boss|User)Id=([^&"'\s]+)/) ??
      decoded.match(/bossId=([^&"'\s]+)/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}

function getCookie(name: string, doc: Document): string {
  return doc.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? ''
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
