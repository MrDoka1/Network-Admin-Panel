import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { reconfigCreateTabPath, reconfigCreateTabIdFromSearch } from '../../routes'
import { ReconfigurationTaskBuilder } from './ReconfigurationTaskBuilder'
import type { DraftBatch } from './reconfigDraftTypes'
import { emptyBatch } from './reconfigDraftTypes'
import {
  createEmptyDraftTab,
  loadDraftTabs,
  removeDraftTab,
  saveDraftTabs,
  type ReconfigDraftStorage,
  type ReconfigDraftTab,
  updateDraftTabBatches,
  upsertDraftTab,
} from './reconfigDraftStorage'
import './ReconfigurationCreatePanel.css'

type Props = {
  onCancel: () => void
  onCreated: () => void
}

export const ReconfigurationCreatePanel = memo(function ReconfigurationCreatePanel({
  onCancel,
  onCreated,
}: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draftState, setDraftState] = useState<ReconfigDraftStorage>(() => loadDraftTabs())

  useEffect(() => {
    saveDraftTabs(draftState)
  }, [draftState])

  const tabFromUrl = reconfigCreateTabIdFromSearch(searchParams.toString())

  useEffect(() => {
    if (!tabFromUrl) return
    setDraftState((prev) => {
      if (!prev.tabs.some((t) => t.id === tabFromUrl)) return prev
      if (prev.activeTabId === tabFromUrl) return prev
      return { ...prev, activeTabId: tabFromUrl }
    })
  }, [tabFromUrl])

  useEffect(() => {
    if (tabFromUrl) return
    navigate(reconfigCreateTabPath(draftState.activeTabId), { replace: true })
  }, [tabFromUrl, draftState.activeTabId, navigate])

  const activeTab = useMemo(
    () =>
      draftState.tabs.find((t) => t.id === draftState.activeTabId) ??
      draftState.tabs[0],
    [draftState],
  )

  const activeTabIdRef = useRef(draftState.activeTabId)
  activeTabIdRef.current = draftState.activeTabId

  const selectTab = useCallback(
    (tabId: string) => {
      setDraftState((prev) => ({ ...prev, activeTabId: tabId }))
      setSearchParams({ tab: tabId }, { replace: true })
    },
    [setSearchParams],
  )

  const addTab = useCallback(() => {
    let newTabId = ''
    setDraftState((prev) => {
      const tab = createEmptyDraftTab(`Задача ${prev.tabs.length + 1}`)
      newTabId = tab.id
      return {
        tabs: [...prev.tabs, tab],
        activeTabId: tab.id,
      }
    })
    if (newTabId) {
      setSearchParams({ tab: newTabId }, { replace: true })
    }
  }, [setSearchParams])

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      let nextActiveId = ''
      setDraftState((prev) => {
        const next = removeDraftTab(prev, tabId)
        if (next.activeTabId !== prev.activeTabId) {
          nextActiveId = next.activeTabId
        }
        return next
      })
      if (nextActiveId) {
        setSearchParams({ tab: nextActiveId }, { replace: true })
      }
    },
    [setSearchParams],
  )

  const updateBatches = useCallback((batches: DraftBatch[]) => {
    setDraftState((prev) =>
      updateDraftTabBatches(prev, activeTabIdRef.current, batches),
    )
  }, [])

  const handleCreated = useCallback(() => {
    if (!activeTab) return
    let nextActiveId = ''
    setDraftState((prev) => {
      const next = removeDraftTab(prev, activeTab.id)
      nextActiveId = next.activeTabId
      return next
    })
    if (nextActiveId) {
      setSearchParams({ tab: nextActiveId }, { replace: true })
    }
    onCreated()
  }, [activeTab, setSearchParams, onCreated])

  if (!activeTab) {
    return null
  }

  return (
    <div className="reconfig-create-panel">
      <DraftTabBar
        tabs={draftState.tabs}
        activeTabId={draftState.activeTabId}
        onSelectTab={selectTab}
        onAddTab={addTab}
        onCloseTab={closeTab}
      />
      <ReconfigurationTaskBuilder
        key={activeTab.id}
        batches={activeTab.batches}
        onBatchesChange={updateBatches}
        onCancel={onCancel}
        onCreated={handleCreated}
      />
    </div>
  )
})

const DraftTabBar = memo(function DraftTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
}: {
  tabs: ReconfigDraftTab[]
  activeTabId: string
  onSelectTab: (tabId: string) => void
  onAddTab: () => void
  onCloseTab: (tabId: string, e: React.MouseEvent) => void
}) {
  return (
    <div
      className="reconfig-create-panel__tabs"
      role="tablist"
      aria-label="Черновики задач"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={
            tab.id === activeTabId
              ? 'reconfig-create-panel__tab reconfig-create-panel__tab--active'
              : 'reconfig-create-panel__tab'
          }
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="reconfig-create-panel__tab-label">{tab.label}</span>
          {tabs.length > 1 ? (
            <span
              className="reconfig-create-panel__tab-close"
              role="button"
              tabIndex={0}
              aria-label={`Закрыть вкладку ${tab.label}`}
              onClick={(e) => onCloseTab(tab.id, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCloseTab(tab.id, e as unknown as React.MouseEvent)
                }
              }}
            >
              ×
            </span>
          ) : null}
        </button>
      ))}
      <button
        type="button"
        className="reconfig-create-panel__tab-add"
        aria-label="Новая вкладка"
        onClick={onAddTab}
      >
        +
      </button>
    </div>
  )
})

export function upsertRollbackDraftTab(
  batches: DraftBatch[],
  label: string,
): { storage: ReconfigDraftStorage; tabId: string } {
  const current = loadDraftTabs()
  const tab = createEmptyDraftTab(label)
  tab.batches = batches.length > 0 ? batches : [emptyBatch('NORMAL')]
  const storage = upsertDraftTab(current, tab)
  saveDraftTabs(storage)
  return { storage, tabId: tab.id }
}
