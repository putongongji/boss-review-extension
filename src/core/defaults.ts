import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  maxPages: 5,
  maxJobs: 100,
  pageDelayMinMs: 1200,
  pageDelayMaxMs: 2600,
  detailDelayMinMs: 700,
  detailDelayMaxMs: 1600,
  dailySendLimit: 30,
  highScoreThreshold: 80,
  mediumScoreThreshold: 60,
  blacklistCompanies: [],
  blacklistRecruiters: [],
  keywordExcludes: ['外包', '销售', '电销'],
}

export const DEFAULT_RESUME_PATH = '/Users/sanjin/无用/find_job/简历.md'
