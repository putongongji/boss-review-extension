export type JobStatus =
  | 'captured'
  | 'enriching'
  | 'filtered'
  | 'scoring'
  | 'drafted'
  | 'reviewing'
  | 'sent'
  | 'skipped'
  | 'failed'

export type ScoreLabel = 'high' | 'medium' | 'low'

export interface CapturedJob {
  jobId: string
  securityId?: string
  lid?: string
  title: string
  company: string
  salary?: string
  location?: string
  workAddress?: string
  experience?: string
  degree?: string
  recruiterName?: string
  recruiterTitle?: string
  recruiterId?: string
  encryptBossId?: string
  companyId?: string
  activeText?: string
  skills: string[]
  welfare: string[]
  jdText?: string
  sourceUrl: string
}

export interface ReviewJob extends CapturedJob {
  status: JobStatus
  statusMessage: string
  capturedAt: number
  greetedAt?: number
  greetingRecordId?: string
  greeting?: GreetingResult
}

export interface GreetingResult {
  score: number
  scoreLabel: ScoreLabel
  jdSummary: string
  matchedEvidence: string[]
  risks: string[]
  greeting: string
  rationale: string
}

export interface Settings {
  maxPages: number
  maxJobs: number
  pageDelayMinMs: number
  pageDelayMaxMs: number
  detailDelayMinMs: number
  detailDelayMaxMs: number
  dailySendLimit: number
  highScoreThreshold: number
  mediumScoreThreshold: number
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  blacklistCompanies: string[]
  blacklistRecruiters: string[]
  keywordExcludes: string[]
}

export interface LocalLogEntry {
  id: string
  jobId: string
  action: 'sent' | 'skipped' | 'copied' | 'rewritten' | 'failed'
  message: string
  createdAt: number
}

export interface GreetingLogEntry {
  id: string
  job: CapturedJob
  defaultGreetingContent: string
  customGreetingEnabled: boolean
  customGreetingContent: string
  customGreetingSent: boolean
  customGreetingError?: string
  resultMessage: string
  createdAt: number
}

export interface GreetOutcome {
  defaultGreetingSent: boolean
  defaultGreetingContent: string
  customGreetingEnabled: boolean
  customGreetingContent: string
  customGreetingSent: boolean
  customGreetingError?: string
  resultMessage: string
  detail?: string
}

export interface GreetedJobRecord {
  jobId: string
  greetedAt: number
  success: boolean
  customGreetingSent: boolean
  error?: string
  resultMessage: string
}
