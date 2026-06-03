import { DEFAULT_SETTINGS } from './defaults'
import type { LocalLogEntry, Settings } from './types'

type StorageRecord = Record<string, unknown>

export interface StorageAreaLike {
  get(keys?: string | string[] | StorageRecord | null): Promise<StorageRecord>
  set(items: StorageRecord): Promise<void>
}

const KEYS = {
  settings: 'settings',
  resumeMaterial: 'resumeMaterial',
  reviewedCompanies: 'reviewedCompanies',
  reviewedRecruiters: 'reviewedRecruiters',
  logs: 'logs',
} as const

export function createMemoryStorageArea(seed: StorageRecord = {}): StorageAreaLike {
  const data = new Map<string, unknown>(Object.entries(seed))

  return {
    async get(keys?: string | string[] | StorageRecord | null) {
      if (keys == null) return Object.fromEntries(data.entries())
      if (typeof keys === 'string') return { [keys]: data.get(keys) }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data.get(key)]))
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [key, data.get(key) ?? fallback]),
      )
    },
    async set(items: StorageRecord) {
      for (const [key, value] of Object.entries(items)) data.set(key, value)
    },
  }
}

export class ExtensionStorage {
  constructor(private readonly area: StorageAreaLike = chrome.storage.local) {}

  async getSettings(): Promise<Settings> {
    const data = await this.area.get({ [KEYS.settings]: {} })
    return { ...DEFAULT_SETTINGS, ...(data[KEYS.settings] as Partial<Settings>) }
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const current = await this.getSettings()
    await this.area.set({ [KEYS.settings]: { ...current, ...settings } })
  }

  async getResumeMaterial(): Promise<string> {
    const data = await this.area.get({ [KEYS.resumeMaterial]: '' })
    return String(data[KEYS.resumeMaterial] ?? '')
  }

  async saveResumeMaterial(material: string): Promise<void> {
    await this.area.set({ [KEYS.resumeMaterial]: material })
  }

  async markCompanyReviewed(companyId: string): Promise<void> {
    await this.addToSet(KEYS.reviewedCompanies, companyId)
  }

  async hasCompanyReviewed(companyId: string): Promise<boolean> {
    return this.hasInSet(KEYS.reviewedCompanies, companyId)
  }

  async markRecruiterReviewed(recruiterId: string): Promise<void> {
    await this.addToSet(KEYS.reviewedRecruiters, recruiterId)
  }

  async hasRecruiterReviewed(recruiterId: string): Promise<boolean> {
    return this.hasInSet(KEYS.reviewedRecruiters, recruiterId)
  }

  async appendLog(entry: LocalLogEntry): Promise<void> {
    const data = await this.area.get({ [KEYS.logs]: [] })
    const logs = Array.isArray(data[KEYS.logs]) ? (data[KEYS.logs] as LocalLogEntry[]) : []
    await this.area.set({ [KEYS.logs]: [entry, ...logs].slice(0, 500) })
  }

  private async addToSet(key: string, value: string): Promise<void> {
    const data = await this.area.get({ [key]: [] })
    const values = new Set(Array.isArray(data[key]) ? (data[key] as string[]) : [])
    values.add(value)
    await this.area.set({ [key]: [...values] })
  }

  private async hasInSet(key: string, value: string): Promise<boolean> {
    const data = await this.area.get({ [key]: [] })
    const values = Array.isArray(data[key]) ? (data[key] as string[]) : []
    return values.includes(value)
  }
}
