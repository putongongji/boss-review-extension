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
  llmBaseUrl: 'https://api.deepseek.com',
  llmApiKey: '',
  llmModel: 'deepseek-chat',
  blacklistCompanies: [],
  blacklistRecruiters: [],
  keywordExcludes: [],
}
