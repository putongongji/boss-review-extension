import type { Settings, CapturedJob } from './types'
import type { BossPageAdapter } from '@/page/bossAdapter'
import { randomBetween, sleep } from '@/utils/delay'

export class ScanController {
  private stopped = false
  private paused = false

  constructor(
    private readonly adapter: BossPageAdapter,
    private readonly settings: Settings,
  ) {}

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  stop(): void {
    this.stopped = true
  }

  async scan(): Promise<CapturedJob[]> {
    const collected = new Map<string, CapturedJob>()

    for (let page = 1; page <= this.settings.maxPages; page += 1) {
      if (this.stopped) break
      await this.waitWhilePaused()

      const jobs = await this.adapter.captureCurrentPage()
      for (const job of jobs) {
        if (this.stopped) break
        if (collected.size >= this.settings.maxJobs) break
        if (!collected.has(job.jobId)) {
          collected.set(job.jobId, job)
        }
      }

      if (this.stopped) break
      if (collected.size >= this.settings.maxJobs) break
      if (page >= this.settings.maxPages) break
      if (!this.adapter.hasNextPage()) break

      if (this.stopped) break
      await sleep(randomBetween(this.settings.pageDelayMinMs, this.settings.pageDelayMaxMs))
      if (this.stopped) break
      const navigated = await this.adapter.goNextPage()
      if (!navigated) break
    }

    return [...collected.values()]
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.paused && !this.stopped) {
      await sleep(100)
    }
  }
}
