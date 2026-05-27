import { v4 as uuidv4 } from 'uuid'
import type { DraftBatch } from './reconfigDraftTypes'
import { emptyBatch } from './reconfigDraftTypes'

export type ReconfigDraftTab = {
  id: string
  label: string
  batches: DraftBatch[]
}

export type ReconfigDraftStorage = {
  tabs: ReconfigDraftTab[]
  activeTabId: string
}

const STORAGE_KEY = 'admin-panel.reconfig-draft-tabs.v1'

function newTabId(): string {
  return uuidv4()
}

export function createEmptyDraftTab(label?: string): ReconfigDraftTab {
  const id = newTabId()
  return {
    id,
    label: label ?? 'Новая задача',
    batches: [emptyBatch('NORMAL')],
  }
}

function defaultStorage(): ReconfigDraftStorage {
  const tab = createEmptyDraftTab()
  return { tabs: [tab], activeTabId: tab.id }
}

export function loadDraftTabs(): ReconfigDraftStorage {
  if (typeof localStorage === 'undefined') {
    return defaultStorage()
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStorage()
    const parsed = JSON.parse(raw) as ReconfigDraftStorage
    if (
      !parsed ||
      !Array.isArray(parsed.tabs) ||
      parsed.tabs.length === 0 ||
      typeof parsed.activeTabId !== 'string'
    ) {
      return defaultStorage()
    }
    const activeExists = parsed.tabs.some((t) => t.id === parsed.activeTabId)
    return {
      tabs: parsed.tabs,
      activeTabId: activeExists ? parsed.activeTabId : parsed.tabs[0].id,
    }
  } catch {
    return defaultStorage()
  }
}

export function saveDraftTabs(state: ReconfigDraftStorage): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function removeDraftTab(state: ReconfigDraftStorage, tabId: string): ReconfigDraftStorage {
  if (state.tabs.length <= 1) {
    const tab = createEmptyDraftTab()
    return { tabs: [tab], activeTabId: tab.id }
  }
  const tabs = state.tabs.filter((t) => t.id !== tabId)
  const activeTabId =
    state.activeTabId === tabId ? tabs[0].id : state.activeTabId
  return { tabs, activeTabId }
}

export function upsertDraftTab(
  state: ReconfigDraftStorage,
  tab: ReconfigDraftTab,
): ReconfigDraftStorage {
  const idx = state.tabs.findIndex((t) => t.id === tab.id)
  const tabs =
    idx >= 0
      ? state.tabs.map((t, i) => (i === idx ? tab : t))
      : [...state.tabs, tab]
  return { tabs, activeTabId: tab.id }
}

export function updateDraftTabBatches(
  state: ReconfigDraftStorage,
  tabId: string,
  batches: DraftBatch[],
): ReconfigDraftStorage {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, batches } : t)),
  }
}

export function updateDraftTabLabel(
  state: ReconfigDraftStorage,
  tabId: string,
  label: string,
): ReconfigDraftStorage {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
  }
}
