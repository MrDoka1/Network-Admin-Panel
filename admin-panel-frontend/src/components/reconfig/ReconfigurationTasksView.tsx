import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchDevices } from '../../api/networkClient'
import {
  cancelReconfigurationTask,
  confirmReconfigurationTask,
  fetchReconfigurationTasks,
} from '../../api/reconfigurationClient'
import { ReconfigurationTaskBuilder } from './ReconfigurationTaskBuilder'
import type { NetworkDevice } from '../../types/network'
import type {
  ActionExecutionStatus,
  BatchCriticality,
  ReconfigurationEntityStatus,
  ReconfigurationTask,
  ReconfigurationVlanAction,
} from '../../types/reconfiguration'
import {
  reconfigSectionFromPathname,
  reconfigSectionPath,
  TAB_PATH,
} from '../../routes'
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
    SET_ACCESS: 'Access-порт',
    SET_TRUNK: 'Trunk',
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

function actionStatusLabel(s: ActionExecutionStatus): string {
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
}

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

function pillClassForAction(s: ActionExecutionStatus): string {
  if (s === 'EXECUTING') {
    return 'reconfig-pill reconfig-pill--running'
  }
  return pillClassForEntity(s as ReconfigurationEntityStatus)
}

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
    case 'SWITCH_VLAN': {
      const port = typeof p.port === 'string' ? p.port : '?'
      const target =
        typeof p.targetVlanId === 'number' ? p.targetVlanId : '?'
      return `порт ${port} → VLAN ${target}`
    }
    default:
      return ''
  }
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

  if (section === null) {
    return null
  }

  return (
    <section className="reconfig-tasks" aria-labelledby="reconfig-tasks-heading">
      <header className="reconfig-tasks__header">
        <div className="reconfig-tasks__title-block">
          <h1 id="reconfig-tasks-heading">Реконфигурационные таски</h1>
          <p className="reconfig-tasks__subtitle">
            {section === 'list' ? (
              <>
                Снимок сообщений из Kafka (чтение с начала топика). Порядок в
                списке — по времени создания записи в UI (новые сверху); в Kafka
                глобальный порядок по времени не гарантируется.
              </>
            ) : (
              <>
                Соберите пакеты и действия, расставьте их перетаскиванием и отправьте
                сообщение в Kafka через API бэкенда.
              </>
            )}
          </p>
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
        <ReconfigurationTaskBuilder
          onCancel={() => selectSection('list')}
          onCreated={() => void load()}
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
          {visibleTasks.map((task) => (
            <article key={task.id} className="reconfig-card">
              <div className="reconfig-card__head">
                <div className="reconfig-card__meta">
                  <span className={pillClassForEntity(task.status)}>
                    {entityStatusLabel(task.status)}
                  </span>
                  {(canCancelTask(task) || canConfirmTask(task.status)) ? (
                    <div className="reconfig-card__actions">
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
              {task.statusReason ? (
                <p className="reconfig-card__status-reason" role="note">
                  {task.statusReason}
                </p>
              ) : null}
              <div className="reconfig-card__body">
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
                          <span className={pillClassForAction(action.status)}>
                            {actionStatusLabel(action.status)}
                          </span>
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
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
})
