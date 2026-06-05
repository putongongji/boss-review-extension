import { createRuleBasedGreeting, validateGreetingResult } from './greeting'
import { generateLlmGreeting } from './llm'
import type { ExtensionStorage } from './storage'
import type { CapturedJob, ReviewJob, Settings } from './types'
import { includesAny } from '@/utils/text'

export interface PipelineInput {
  job: CapturedJob
  resumeMaterial: string
  settings: Settings
  storage: ExtensionStorage
}

export async function runJobPipeline(input: PipelineInput): Promise<ReviewJob> {
  const { resumeMaterial, settings, storage } = input
  const job = normalizeJob(input.job)
  const base = toReviewJob(job, 'captured', '已抓取')

  if (job.companyId && (await storage.hasCompanyReviewed(job.companyId))) {
    return { ...base, status: 'filtered', statusMessage: '同公司已处理' }
  }

  if (job.recruiterId && (await storage.hasRecruiterReviewed(job.recruiterId))) {
    return { ...base, status: 'filtered', statusMessage: '同招聘者已处理' }
  }

  if (settings.blacklistCompanies.includes(job.company)) {
    return { ...base, status: 'filtered', statusMessage: '公司在黑名单中' }
  }

  const recruiterValues = [job.recruiterId, job.recruiterName].filter((value): value is string => Boolean(value))
  if (recruiterValues.some((value) => settings.blacklistRecruiters.includes(value))) {
    return { ...base, status: 'filtered', statusMessage: '招聘者在黑名单中' }
  }

  const filterText = `${job.title} ${job.company} ${job.jdText ?? ''}`
  if (settings.keywordExcludes.length > 0 && includesAny(filterText, settings.keywordExcludes)) {
    return { ...base, status: 'filtered', statusMessage: '命中排除关键词' }
  }

  let greeting = createRuleBasedGreeting(job, resumeMaterial)
  if (job.jdText && settings.llmApiKey) {
    greeting = (await generateLlmGreeting(job, resumeMaterial, settings)) ?? greeting
  }

  const validation = validateGreetingResult(greeting, job, resumeMaterial)
  if (!validation.ok) {
    return { ...base, status: 'failed', statusMessage: validation.reason, greeting }
  }

  return {
    ...base,
    status: 'drafted',
    statusMessage: '已生成草稿',
    greeting,
  }
}

function normalizeJob(job: CapturedJob): CapturedJob {
  return {
    ...job,
    skills: Array.isArray(job.skills) ? job.skills.filter((item): item is string => typeof item === 'string') : [],
    welfare: Array.isArray(job.welfare) ? job.welfare.filter((item): item is string => typeof item === 'string') : [],
  }
}

function toReviewJob(job: CapturedJob, status: ReviewJob['status'], statusMessage: string): ReviewJob {
  return {
    ...job,
    status,
    statusMessage,
    capturedAt: Date.now(),
  }
}
