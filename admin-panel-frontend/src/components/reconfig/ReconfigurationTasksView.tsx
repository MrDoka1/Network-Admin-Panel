import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchDevices, fetchVlans } from '../../api/networkClient'
import {
  cancelReconfigurationTask,
  confirmReconfigurationTask,
  fetchReconfigurationTasks,
} from '../../api/reconfigurationClient'
import {
  ReconfigurationCreatePanel,
  upsertRollbackDraftTab,
} from './ReconfigurationCreatePanel'
import { ReconfigRollbackToast } from './ReconfigRollbackToast'
import type { DeviceInterface, NetworkDevice, Vlan } from '../../types/network'
import type {
  BatchCriticality,
  ReconfigurationBatchView,
  ReconfigurationEntityStatus,
  ReconfigurationTask,
  ReconfigurationVlanAction,
} from '../../types/reconfiguration'
import {
  reconfigSectionFromPathname,
  reconfigSectionPath,
  TAB_PATH,
} from '../../routes'
import type { DraftBatch } from './reconfigDraftTypes'
import {
  buildRollbackBatchesForAction,
  buildRollbackBatchesForBatch,
  buildRollbackBatchesForTask,
  collectActionsFromTask,
  isRollbackEligibleStatus,
  loadInterfacesForActions,
} from './reconfigRollback'
import './ReconfigurationTasksView.css'

const COMPLETED_TASK_STATUSES: ReadonlySet<ReconfigurationEntityStatus> = new Set([
  'SUCCESS',
  'FAILED',
  'ROLLED_BACK',
])

function isCompletedTask(task: ReconfigurationTask): boolean {
  return COMPLETED_TASK_STATUSES.has(task.status)
}

const ACTION_TYPE_LABEL: Record<ReconfigurationVlanAction['actionType'], string> =
  {
    ADD_VLAN: 'Добавить VLAN',
    DELETE_VLAN: 'Удалить VLAN',
    CREATE_SUBINTERFACE: 'Создать subinterface',
    DELETE_SUBINTERFACE: 'Удалить subinterface',
    SET_ACCESS: 'Access-порт',
    SET_TRUNK: 'Trunk',
    EDIT_TRUNK: 'Изменить trunk',
    SWITCH_VLAN: 'Смена VLAN',
  }

function canCancelTask(task: ReconfigurationTask): boolean {
  const status = task.status ?? 'PENDING'
  if (status === 'PENDING' || status === 'AWAITING_CONFIRMATION') {
    return true
  }
  /*if (status === 'RUNNING') {
    return (
      task.batches.length === 0 ||
      task.batches.every((batch) => batch.status === 'PENDING')
    )
  }*/
  return false
}

function canConfirmTask(status: ReconfigurationEntityStatus): boolean {
  return status === 'AWAITING_CONFIRMATION'
}

function entityStatusLabel(s: ReconfigurationEntityStatus): string {
  switch (s) {
    case 'PENDING':
      return 'Ожидает'
    case 'AWAITING_CONFIRMATION':
      return 'Ожидает подтверждения'
    case 'CONFIRMED':
      return 'Подтверждено'
    case 'RUNNING':
      return 'Выполняется'
    case 'SUCCESS':
      return 'Успех'
    case 'FAILED':
      return 'Ошибка'
    case 'ROLLED_BACK':
      return 'Откат'
    case 'CANCEL':
      return 'Отменена'
    default:
      return s
  }
}

/*function actionStatusLabel(s: ActionExecutionStatus): string {
  switch (s) {
    case 'PENDING':
      return 'Ожидает'
    case 'EXECUTING':
      return 'В работе'
    case 'SUCCESS':
      return 'Успех'
    case 'FAILED':
      return 'Ошибка'
    case 'ROLLED_BACK':
      return 'Откат'
    default:
      return s
  }
}*/

function criticalityLabel(c: BatchCriticality): string {
  switch (c) {
    case 'CRITICAL':
      return 'Критичный'
    case 'NORMAL':
      return 'Обычный'
    case 'OPTIONAL':
      return 'Опциональный'
    default:
      return c
  }
}

function pillClassForEntity(s: ReconfigurationEntityStatus): string {
  switch (s) {
    case 'PENDING':
      return 'reconfig-pill reconfig-pill--pending'
    case 'AWAITING_CONFIRMATION':
      return 'reconfig-pill reconfig-pill--awaiting'
    case 'CONFIRMED':
      return 'reconfig-pill reconfig-pill--confirmed'
    case 'RUNNING':
      return 'reconfig-pill reconfig-pill--running'
    case 'SUCCESS':
      return 'reconfig-pill reconfig-pill--success'
    case 'FAILED':
      return 'reconfig-pill reconfig-pill--failed'
    case 'ROLLED_BACK':
      return 'reconfig-pill reconfig-pill--rolled'
    case 'CANCEL':
      return 'reconfig-pill reconfig-pill--cancel'
    default:
      return 'reconfig-pill'
  }
}

// function pillClassForAction(s: ActionExecutionStatus): string {
//   if (s === 'EXECUTING') {
//     return 'reconfig-pill reconfig-pill--running'
//   }
//   return pillClassForEntity(s as ReconfigurationEntityStatus)
// }

function pillClassForCriticality(c: BatchCriticality): string {
  switch (c) {
    case 'CRITICAL':
      return 'reconfig-pill reconfig-pill--crit'
    case 'NORMAL':
      return 'reconfig-pill reconfig-pill--norm'
    case 'OPTIONAL':
      return 'reconfig-pill reconfig-pill--opt'
    default:
      return 'reconfig-pill reconfig-pill--opt'
  }
}

function batchSectionClass(c: BatchCriticality): string {
  const base = 'reconfig-batch'
  if (c === 'CRITICAL') return `${base} reconfig-batch--critical`
  if (c === 'NORMAL') return `${base} reconfig-batch--normal`
  if (c === 'OPTIONAL') return `${base} reconfig-batch--optional`
  return base
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function vlanIdFromSwitchPortState(state: unknown): number | null {
  if (
    state != null &&
    typeof state === 'object' &&
    'vlanId' in state &&
    typeof (state as { vlanId: unknown }).vlanId === 'number'
  ) {
    return (state as { vlanId: number }).vlanId
  }
  return null
}

function vlanIdsFromEditTrunkState(state: unknown): number[] {
  if (
    state != null &&
    typeof state === 'object' &&
    'allowedVlans' in state &&
    Array.isArray((state as { allowedVlans: unknown }).allowedVlans)
  ) {
    return (state as { allowedVlans: unknown[] }).allowedVlans.filter(
      (x): x is number => typeof x === 'number',
    )
  }
  return []
}

function nativeVlanFromEditTrunkState(state: unknown): number | null {
  if (
    state != null &&
    typeof state === 'object' &&
    'nativeVlanId' in state &&
    typeof (state as { nativeVlanId: unknown }).nativeVlanId === 'number'
  ) {
    return (state as { nativeVlanId: number }).nativeVlanId
  }
  return null
}

function describeAction(a: ReconfigurationVlanAction): string {
  const p = a.params ?? {}
  switch (a.actionType) {
    case 'ADD_VLAN': {
      const vlanId = typeof p.vlanId === 'number' ? p.vlanId : '?'
      const name = typeof p.name === 'string' && p.name ? ` «${p.name}»` : ''
      return `VLAN ${vlanId}${name}`
    }
    case 'DELETE_VLAN': {
      const vlanId = typeof p.vlanId === 'number' ? p.vlanId : '?'
      return `VLAN ${vlanId}`
    }
    case 'CREATE_SUBINTERFACE': {
      const parent =
        typeof p.parentInterface === 'string' && p.parentInterface ? p.parentInterface : '?'
      const vlanId = typeof p.vlanId === 'number' ? p.vlanId : '?'
      const ip =
        typeof p.ipAddress === 'string' && p.ipAddress ? p.ipAddress : '—'
      return `${parent} · VLAN ${vlanId} · ${ip}`
    }
    case 'DELETE_SUBINTERFACE': {
      const parent =
        typeof p.parentInterface === 'string' && p.parentInterface ? p.parentInterface : '?'
      const vlanId = typeof p.vlanId === 'number' ? p.vlanId : '?'
      return `${parent} · VLAN ${vlanId}`
    }
    case 'SET_ACCESS': {
      const port = typeof p.port === 'string' ? p.port : '?'
      const vlanId = typeof p.vlanId === 'number' ? p.vlanId : '?'
      return `порт ${port}, VLAN ${vlanId}`
    }
    case 'SET_TRUNK': {
      const port = typeof p.port === 'string' ? p.port : '?'
      const allowed = Array.isArray(p.allowedVlans)
        ? (p.allowedVlans as unknown[])
            .filter((x): x is number => typeof x === 'number')
            .join(', ')
        : '—'
      const native =
        p.nativeVlanId != null && typeof p.nativeVlanId === 'number'
          ? String(p.nativeVlanId)
          : '—'
      return `порт ${port}, разрешены: ${allowed}, native: ${native}`
    }
    case 'EDIT_TRUNK': {
      const port = typeof p.port === 'string' ? p.port : '?'
      const prevAllowed = vlanIdsFromEditTrunkState(a.previousState).join(', ') || '—'
      const nextAllowed = vlanIdsFromEditTrunkState(a.targetState).join(', ') || '—'
      const prevNative = nativeVlanFromEditTrunkState(a.previousState)
      const nextNative = nativeVlanFromEditTrunkState(a.targetState)
      const prevNativeStr = prevNative != null ? String(prevNative) : '—'
      const nextNativeStr = nextNative != null ? String(nextNative) : '—'
      return `порт ${port}: VLAN [${prevAllowed}] native ${prevNativeStr} → [${nextAllowed}] native ${nextNativeStr}`
    }
    case 'SWITCH_VLAN': {
      const port = typeof p.port === 'string' ? p.port : '?'
      const fromVlan = vlanIdFromSwitchPortState(a.previousState)
      const toVlan =
        typeof p.targetVlanId === 'number'
          ? p.targetVlanId
          : vlanIdFromSwitchPortState(a.targetState)
      const from = fromVlan != null ? String(fromVlan) : '?'
      const to = toVlan != null ? String(toVlan) : '?'
      return `порт ${port} VLAN ${from} → VLAN ${to}`
    }
    default:
      return ''
  }
}

function taskStats(task: ReconfigurationTask): {
  batchCount: number
  actionCount: number
} {
  const batchCount = task.batches.length
  const actionCount = task.batches.reduce((n, b) => n + b.actions.length, 0)
  return { batchCount, actionCount }
}

function truncateOneLine(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLen) return normalized
  return `${normalized.slice(0, maxLen - 1)}…`
}

function taskCollapsedSummary(task: ReconfigurationTask): string {
  const { batchCount, actionCount } = taskStats(task)
  const batchWord =
    batchCount === 1 ? 'пакет' : batchCount < 5 ? 'пакета' : 'пакетов'
  const actionWord =
    actionCount === 1 ? 'действие' : actionCount < 5 ? 'действия' : 'действий'
  const previews = task.batches
    .flatMap((b) => b.actions)
    .slice(0, 2)
    .map((a) => describeAction(a))
    .filter(Boolean)
  const preview =
    previews.length > 0
      ? ` · ${previews.join('; ')}${actionCount > 2 ? '…' : ''}`
      : ''
  const reason = task.statusReason?.trim()
    ? ` · ${truncateOneLine(task.statusReason, 100)}`
    : ''
  return `${batchCount} ${batchWord}, ${actionCount} ${actionWord}${preview}${reason}`
}

function isInteractiveCardHeadTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, label, [role="button"], [role="link"]',
    ),
  )
}

function sortTasksNewestFirst(tasks: ReconfigurationTask[]): ReconfigurationTask[] {
  return [...tasks].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    const na = Number.isNaN(ta) ? 0 : ta
    const nb = Number.isNaN(tb) ? 0 : tb
    return nb - na
  })
}

function networkDeviceTooltip(
  deviceId: string,
  d: NetworkDevice | undefined,
): string {
  if (!d) return deviceId
  return `${d.hostname} (${d.mgmtIp})\n${deviceId}`
}

export const ReconfigurationTasksView = memo(function ReconfigurationTasksView() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = reconfigSectionFromPathname(pathname)

  useEffect(() => {
    if (section === null && pathname.startsWith(TAB_PATH.reconfigTasks)) {
      navigate(TAB_PATH.reconfigTasks, { replace: true })
    }
  }, [section, pathname, navigate])

  function selectSection(next: 'list' | 'create') {
    const path = reconfigSectionPath(next)
    if (pathname !== path) {
      navigate(path)
    }
  }
  const [tasks, setTasks] = useState<ReconfigurationTask[]>([])
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [rollbackToastTabId, setRollbackToastTabId] = useState<string | null>(
    null,
  )
  const [rollbackBusy, setRollbackBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, devices] = await Promise.all([
        fetchReconfigurationTasks({
          maxRecords: 500,
          maxWaitSeconds: 45,
        }),
        fetchDevices().catch(() => [] as NetworkDevice[]),
      ])
      setTasks(list)
      setNetworkDevices(devices)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => sortTasksNewestFirst(tasks), [tasks])

  const visibleTasks = useMemo(
    () =>
      showCompleted ? sorted : sorted.filter((task) => !isCompletedTask(task)),
    [sorted, showCompleted],
  )

  const networkDeviceById = useMemo(() => {
    const m = new Map<string, NetworkDevice>()
    for (const d of networkDevices) m.set(d.id, d)
    return m
  }, [networkDevices])

  const mergeTaskUpdate = useCallback((updated: ReconfigurationTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    )
  }, [])

  const handleCancel = useCallback(
    async (taskId: string) => {
      if (!window.confirm('Отменить эту задачу реконфигурации?')) return
      setActionTaskId(taskId)
      setError(null)
      try {
        const updated = await cancelReconfigurationTask(taskId)
        mergeTaskUpdate(updated)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setActionTaskId(null)
      }
    },
    [mergeTaskUpdate],
  )

  const toggleTaskCollapsed = useCallback((taskId: string) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const collapseAllVisible = useCallback(() => {
    setCollapsedTaskIds(new Set(visibleTasks.map((t) => t.id)))
  }, [visibleTasks])

  const expandAllVisible = useCallback(() => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev)
      for (const t of visibleTasks) next.delete(t.id)
      return next
    })
  }, [visibleTasks])

  const handleConfirm = useCallback(
    async (taskId: string) => {
      if (!window.confirm('Подтвердить выполнение этой задачи?')) return
      setActionTaskId(taskId)
      setError(null)
      try {
        const updated = await confirmReconfigurationTask(taskId)
        mergeTaskUpdate(updated)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setActionTaskId(null)
      }
    },
    [mergeTaskUpdate],
  )

  const openRollbackTab = useCallback(
    async (
      label: string,
      build: (
        ifacesByDevice: Map<string, DeviceInterface[]>,
        vlans: Vlan[],
      ) => DraftBatch[],
      actionsForFetch: ReconfigurationVlanAction[],
    ) => {
      setRollbackBusy(true)
      setError(null)
      try {
        const [ifacesByDevice, vlans] = await Promise.all([
          loadInterfacesForActions(actionsForFetch),
          fetchVlans().catch(() => []),
        ])
        const batches = build(ifacesByDevice, vlans)
        const { tabId } = upsertRollbackDraftTab(batches, label)
        setRollbackToastTabId(tabId)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setRollbackBusy(false)
      }
    },
    [],
  )

  const handleRollbackAction = useCallback(
    (action: ReconfigurationVlanAction) => {
      void openRollbackTab(
        'Откат действия',
        (ifaces, vlans) => buildRollbackBatchesForAction(action, ifaces, vlans),
        [action],
      )
    },
    [openRollbackTab],
  )

  const handleRollbackBatch = useCallback(
    (batch: ReconfigurationBatchView) => {
      void openRollbackTab(
        'Откат пакета',
        (ifaces, vlans) => buildRollbackBatchesForBatch(batch, ifaces, vlans),
        batch.actions,
      )
    },
    [openRollbackTab],
  )

  const handleRollbackTask = useCallback(
    (task: ReconfigurationTask) => {
      const actions = collectActionsFromTask(task)
      void openRollbackTab(
        'Откат задачи',
        (ifaces, vlans) => buildRollbackBatchesForTask(task, ifaces, vlans),
        actions,
      )
    },
    [openRollbackTab],
  )

  if (section === null) {
    return null
  }

  return (
    <section className="reconfig-tasks" aria-labelledby="reconfig-tasks-heading">
      <header className="reconfig-tasks__header">
        <div className="reconfig-tasks__title-block">
          <h1 id="reconfig-tasks-heading">Реконфигурационные таски</h1>
          
        </div>
        <div className="reconfig-tasks__subtabs" role="tablist" aria-label="Режим">
          <button
            type="button"
            role="tab"
            aria-selected={section === 'list'}
            className={
              section === 'list'
                ? 'reconfig-tasks__subtab reconfig-tasks__subtab--active'
                : 'reconfig-tasks__subtab'
            }
            onClick={() => selectSection('list')}
          >
            Список из Kafka
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'create'}
            className={
              section === 'create'
                ? 'reconfig-tasks__subtab reconfig-tasks__subtab--active'
                : 'reconfig-tasks__subtab'
            }
            onClick={() => selectSection('create')}
          >
            Создать задачу
          </button>
        </div>
        <div className="reconfig-tasks__actions">
          {section === 'list' ? (
            <>
              <label className="reconfig-tasks__filter">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                <span>Показывать завершённые</span>
              </label>
              {visibleTasks.length > 0 ? (
                <>
                  <button
                    type="button"
                    className="reconfig-tasks__btn"
                    onClick={expandAllVisible}
                  >
                    Развернуть все
                  </button>
                  <button
                    type="button"
                    className="reconfig-tasks__btn"
                    onClick={collapseAllVisible}
                  >
                    Свернуть все
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="reconfig-tasks__btn reconfig-tasks__btn--primary"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? 'Загрузка…' : 'Обновить'}
              </button>
            </>
          ) : null}
        </div>
      </header>
      {section === 'create' ? (
        <ReconfigurationCreatePanel
          onCancel={() => selectSection('list')}
          onCreated={() => void load()}
        />
      ) : null}
      {rollbackToastTabId ? (
        <ReconfigRollbackToast
          tabId={rollbackToastTabId}
          onDismiss={() => setRollbackToastTabId(null)}
        />
      ) : null}
      {section === 'list' && error ? (
        <p className="reconfig-tasks__error" role="alert">
          {error}
        </p>
      ) : null}
      {section === 'list' ? (
        <div className="reconfig-tasks__scroll">
          {!loading && sorted.length === 0 ? (
            <div className="reconfig-tasks__empty">
              <strong>Задач пока нет</strong>
              В топике не найдено сообщений в пределах лимита и таймаута чтения.
              После появления задач в Kafka они отобразятся здесь.
            </div>
          ) : null}
          {!loading && sorted.length > 0 && visibleTasks.length === 0 ? (
            <div className="reconfig-tasks__empty">
              <strong>Активных задач нет</strong>
              Все загруженные задачи завершены. Включите «Показывать завершённые»,
              чтобы увидеть задачи со статусом Успех, Ошибка или Откат.
            </div>
          ) : null}
          {loading && sorted.length === 0 ? (
            <div className="reconfig-tasks__empty">Загрузка списка…</div>
          ) : null}
          {visibleTasks.map((task) => {
            const collapsed = collapsedTaskIds.has(task.id)
            return (
            <article
              key={task.id}
              className={
                collapsed
                  ? 'reconfig-card reconfig-card--collapsed'
                  : 'reconfig-card'
              }
            >
              <div
                className="reconfig-card__head"
                onClick={(e) => {
                  if (isInteractiveCardHeadTarget(e.target)) return
                  toggleTaskCollapsed(task.id)
                }}
              >
                <button
                  type="button"
                  className="reconfig-card__toggle"
                  aria-expanded={!collapsed}
                  aria-controls={`reconfig-card-body-${task.id}`}
                  title={collapsed ? 'Развернуть задачу' : 'Свернуть задачу'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTaskCollapsed(task.id)
                  }}
                >
                  <span
                    className={
                      collapsed
                        ? 'reconfig-card__chevron reconfig-card__chevron--collapsed'
                        : 'reconfig-card__chevron'
                    }
                    aria-hidden
                  />
                </button>
                <div className="reconfig-card__meta">
                  <span className={pillClassForEntity(task.status)}>
                    {entityStatusLabel(task.status)}
                  </span>
                  {(canCancelTask(task) ||
                    canConfirmTask(task.status) ||
                    isRollbackEligibleStatus(task.status)) ? (
                    <div className="reconfig-card__actions">
                      {isRollbackEligibleStatus(task.status) ? (
                        <button
                          type="button"
                          className="reconfig-tasks__btn reconfig-card__btn reconfig-card__btn--rollback"
                          disabled={rollbackBusy}
                          onClick={() => void handleRollbackTask(task)}
                        >
                          Откатить
                        </button>
                      ) : null}
                      {canCancelTask(task) ? (
                        <button
                          type="button"
                          className="reconfig-tasks__btn reconfig-card__btn reconfig-card__btn--danger"
                          disabled={actionTaskId === task.id}
                          onClick={() => void handleCancel(task.id)}
                        >
                          {actionTaskId === task.id ? '…' : 'Отменить'}
                        </button>
                      ) : null}
                      {canConfirmTask(task.status) ? (
                        <button
                          type="button"
                          className="reconfig-tasks__btn reconfig-card__btn reconfig-card__btn--primary"
                          disabled={actionTaskId === task.id}
                          onClick={() => void handleConfirm(task.id)}
                        >
                          {actionTaskId === task.id ? '…' : 'Подтвердить'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <time
                    className="reconfig-card__time"
                    dateTime={task.createdAt}
                  >
                    {formatWhen(task.createdAt)}
                  </time>
                  {task.initiatedBy ? (
                    <span className="reconfig-card__user">
                      кем: <strong>{task.initiatedBy}</strong>
                    </span>
                  ) : (
                    <span className="reconfig-card__user">инициатор не указан</span>
                  )}
                  {task.updatedAt ? (
                    <span className="reconfig-card__status-meta">
                      статус обновлён:{' '}
                      <time dateTime={task.updatedAt}>
                        {formatWhen(task.updatedAt)}
                      </time>
                    </span>
                  ) : null}
                  {task.updatedBy ? (
                    <span className="reconfig-card__status-meta">
                      автор статуса: <strong>{task.updatedBy}</strong>
                    </span>
                  ) : null}
                </div>
                <span className="reconfig-card__id" title={task.id}>
                  {task.id}
                </span>
              </div>
              {collapsed ? (
                <p className="reconfig-card__summary">
                  {taskCollapsedSummary(task)}
                </p>
              ) : (
                <>
                  {task.statusReason ? (
                    <p className="reconfig-card__status-reason" role="note">
                      {task.statusReason}
                    </p>
                  ) : null}
                  <div
                    id={`reconfig-card-body-${task.id}`}
                    className="reconfig-card__body"
                  >
                {task.batches.map((batch, idx) => (
                  <div
                    key={batch.id}
                    className={batchSectionClass(batch.criticality)}
                  >
                    <div className="reconfig-batch__row">
                      <span className="reconfig-batch__label">
                        Пакет {idx + 1}
                      </span>
                      <span className={pillClassForCriticality(batch.criticality)}>
                        {criticalityLabel(batch.criticality)}
                      </span>
                      <span className={pillClassForEntity(batch.status)}>
                        {entityStatusLabel(batch.status)}
                      </span>
                      <span className="reconfig-batch__id" title={batch.id}>
                        {batch.id}
                      </span>
                      {batch.updatedAt ? (
                        <span className="reconfig-batch__status-meta">
                          статус:{' '}
                          <time dateTime={batch.updatedAt}>
                            {formatWhen(batch.updatedAt)}
                          </time>
                        </span>
                      ) : null}
                      {isRollbackEligibleStatus(batch.status) ? (
                        <button
                          type="button"
                          className="reconfig-tasks__btn reconfig-card__btn reconfig-card__btn--rollback reconfig-batch__rollback"
                          disabled={rollbackBusy}
                          onClick={() => void handleRollbackBatch(batch)}
                        >
                          Откатить
                        </button>
                      ) : null}
                    </div>
                    <ul className="reconfig-actions">
                      {batch.actions.map((action) => {
                        const netDev = networkDeviceById.get(action.deviceId)
                        return (
                        <li
                          key={action.id}
                          className="reconfig-actions__item"
                        >
                          <span className="reconfig-actions__type">
                            {ACTION_TYPE_LABEL[action.actionType]}
                          </span>
                          {/*<span className={pillClassForAction(action.status)}>*/}
                          {/*  {actionStatusLabel(action.status)}*/}
                          {/*</span>*/}
                          {isRollbackEligibleStatus(action.status) ? (
                            <button
                              type="button"
                              className="reconfig-tasks__btn reconfig-card__btn reconfig-card__btn--rollback reconfig-actions__rollback"
                              disabled={rollbackBusy}
                              onClick={() => void handleRollbackAction(action)}
                            >
                              Откатить
                            </button>
                          ) : null}
                          <span className="reconfig-actions__detail">
                            {describeAction(action)}
                          </span>
                          <span
                            className="reconfig-actions__device"
                            title={networkDeviceTooltip(action.deviceId, netDev)}
                          >
                            устройство{' '}
                            {netDev ? (
                              <>
                                <span className="reconfig-actions__device-name">
                                  {netDev.hostname}
                                </span>
                                <span className="reconfig-actions__device-sep">
                                  {' '}
                                  —{' '}
                                </span>
                              </>
                            ) : null}
                            <span className="reconfig-actions__device-id">
                              {action.deviceId}
                            </span>
                          </span>
                        </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
                  </div>
                </>
              )}
            </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
})
