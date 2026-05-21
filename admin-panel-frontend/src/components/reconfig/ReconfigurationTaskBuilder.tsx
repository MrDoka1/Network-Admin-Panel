import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createReconfigurationTask } from '../../api/reconfigurationClient'
import {
  fetchDevices,
  fetchInterfacesForDevice,
  fetchVlans,
} from '../../api/networkClient'
import type { DeviceInterface, NetworkDevice, Vlan } from '../../types/network'
import type {
  BatchCriticality,
  ReconfigurationActionType,
  ReconfigurationTaskCreateRequest,
  ReconfigurationVlanActionCreatePayload,
} from '../../types/reconfiguration'
import './ReconfigurationTaskBuilder.css'

const DND_MIME = 'application/x-admin-reconfig-dnd'

type DndPayload =
  | { t: 'palette-action'; kind: ReconfigurationActionType }
  | { t: 'palette-batch'; criticality: BatchCriticality }
  | { t: 'move-action'; batchIndex: number; actionIndex: number }
  | { t: 'move-batch'; batchIndex: number }

const ACTION_LABEL: Record<ReconfigurationActionType, string> = {
  ADD_VLAN: 'Добавить VLAN',
  DELETE_VLAN: 'Удалить VLAN',
  SET_ACCESS: 'Access-порт',
  SET_TRUNK: 'Trunk',
  SWITCH_VLAN: 'Смена VLAN',
}

const BATCH_PALETTE: { criticality: BatchCriticality; title: string; desc: string; cls: string }[] =
  [
    {
      criticality: 'CRITICAL',
      title: 'Пакет · критичный',
      desc: 'Выполняется в первую очередь, выделен визуально.',
      cls: 'reconfig-builder__tpl--crit',
    },
    {
      criticality: 'NORMAL',
      title: 'Пакет · обычный',
      desc: 'Стандартный пакет действий.',
      cls: 'reconfig-builder__tpl--norm',
    },
    {
      criticality: 'OPTIONAL',
      title: 'Пакет · опциональный',
      desc: 'Менее приоритетные изменения.',
      cls: 'reconfig-builder__tpl--opt',
    },
  ]

const ACTION_PALETTE: {
  kind: ReconfigurationActionType
  title: string
  desc: string
}[] = [
  {
    kind: 'ADD_VLAN',
    title: ACTION_LABEL.ADD_VLAN,
    desc: 'Создать VLAN на устройстве.',
  },
  {
    kind: 'DELETE_VLAN',
    title: ACTION_LABEL.DELETE_VLAN,
    desc: 'Удалить VLAN.',
  },
  {
    kind: 'SET_ACCESS',
    title: ACTION_LABEL.SET_ACCESS,
    desc: 'Порт в режиме access, один VLAN.',
  },
  {
    kind: 'SET_TRUNK',
    title: ACTION_LABEL.SET_TRUNK,
    desc: 'Trunk: список VLAN и native.',
  },
  {
    kind: 'SWITCH_VLAN',
    title: ACTION_LABEL.SWITCH_VLAN,
    desc: 'Переключить access-порт на другой VLAN.',
  },
]

type DraftBatch = {
  id: string
  criticality: BatchCriticality
  actions: DraftAction[]
}

type DraftAction =
  | {
      rowKey: string
      actionType: 'ADD_VLAN'
      id: string
      deviceId: string
      vlanId: string
      name: string
    }
  | {
      rowKey: string
      actionType: 'DELETE_VLAN'
      id: string
      deviceId: string
      vlanId: string
    }
  | {
      rowKey: string
      actionType: 'SET_ACCESS'
      id: string
      deviceId: string
      port: string
      vlanId: string
      /** previous_state: порт был в trunk, эти VLAN в allowed */
      previousAllowedVlanIds: number[]
    }
  | {
      rowKey: string
      actionType: 'SET_TRUNK'
      id: string
      deviceId: string
      port: string
      allowedVlanIds: number[]
      nativeVlanId: string
      /** previous_state: порт был в access на этом VLAN */
      previousAccessVlanId: string
    }
  | {
      rowKey: string
      actionType: 'SWITCH_VLAN'
      id: string
      deviceId: string
      port: string
      targetVlanId: string
      /** previous_state: VLAN до переключения */
      previousVlanId: string
    }

function newId(): string {
  return crypto.randomUUID()
}

function emptyBatch(criticality: BatchCriticality): DraftBatch {
  return {
    id: newId(),
    criticality,
    actions: [],
  }
}

function newDraftAction(kind: ReconfigurationActionType): DraftAction {
  const id = newId()
  const rowKey = newId()
  const deviceId = ''
  switch (kind) {
    case 'ADD_VLAN':
      return {
        rowKey,
        actionType: 'ADD_VLAN',
        id,
        deviceId,
        vlanId: '',
        name: '',
      }
    case 'DELETE_VLAN':
      return { rowKey, actionType: 'DELETE_VLAN', id, deviceId, vlanId: '' }
    case 'SET_ACCESS':
      return {
        rowKey,
        actionType: 'SET_ACCESS',
        id,
        deviceId,
        port: '',
        vlanId: '',
        previousAllowedVlanIds: [],
      }
    case 'SET_TRUNK':
      return {
        rowKey,
        actionType: 'SET_TRUNK',
        id,
        deviceId,
        port: '',
        allowedVlanIds: [],
        nativeVlanId: '',
        previousAccessVlanId: '',
      }
    case 'SWITCH_VLAN':
      return {
        rowKey,
        actionType: 'SWITCH_VLAN',
        id,
        deviceId,
        port: '',
        targetVlanId: '',
        previousVlanId: '',
      }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

function parsePositiveInt(s: string): number | null {
  const n = Number.parseInt(s.trim(), 10)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 4094) return null
  return n
}

function insertActionAt(
  batches: DraftBatch[],
  batchIndex: number,
  insertIndex: number,
  action: DraftAction,
): DraftBatch[] {
  return batches.map((b, i) => {
    if (i !== batchIndex) return b
    const next = [...b.actions]
    next.splice(insertIndex, 0, action)
    return { ...b, actions: next }
  })
}

function removeActionAt(
  batches: DraftBatch[],
  batchIndex: number,
  actionIndex: number,
): DraftBatch[] {
  return batches.map((b, i) => {
    if (i !== batchIndex) return b
    return {
      ...b,
      actions: b.actions.filter((_, j) => j !== actionIndex),
    }
  })
}

function moveAction(
  batches: DraftBatch[],
  fromB: number,
  fromA: number,
  toB: number,
  toIdx: number,
): DraftBatch[] {
  const moving = batches[fromB].actions[fromA]
  const removed = removeActionAt(batches, fromB, fromA)
  let idx = toIdx
  if (fromB === toB && fromA < toIdx) {
    idx = toIdx - 1
  }
  return insertActionAt(removed, toB, idx, moving)
}

function insertBatchAt(
  batches: DraftBatch[],
  insertIndex: number,
  batch: DraftBatch,
): DraftBatch[] {
  const copy = [...batches]
  copy.splice(insertIndex, 0, batch)
  return copy
}

function removeBatchAt(batches: DraftBatch[], batchIndex: number): DraftBatch[] {
  return batches.filter((_, i) => i !== batchIndex)
}

/**
 * slotIndex: вставить перед элементом с этим индексом в исходном массиве,
 * либо `batches.length` — в конец.
 */
function moveBatchToSlot(
  batches: DraftBatch[],
  from: number,
  slotIndex: number,
): DraftBatch[] {
  const n = batches.length
  if (from < 0 || from >= n || slotIndex < 0 || slotIndex > n) {
    return batches
  }
  const copy = [...batches]
  const [b] = copy.splice(from, 1)
  let insertAt = slotIndex
  if (from < slotIndex) {
    insertAt = slotIndex - 1
  }
  copy.splice(insertAt, 0, b)
  return copy
}

function readDnd(e: React.DragEvent): DndPayload | null {
  try {
    const raw =
      e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain')
    if (!raw) return null
    return JSON.parse(raw) as DndPayload
  } catch {
    return null
  }
}

function setDnd(e: React.DragEvent, payload: DndPayload) {
  const json = JSON.stringify(payload)
  e.dataTransfer.setData(DND_MIME, json)
  e.dataTransfer.setData('text/plain', json)
  e.dataTransfer.effectAllowed =
    payload.t === 'palette-action' || payload.t === 'palette-batch'
      ? 'copy'
      : 'move'
}

function readDroppedPayload(
  e: React.DragEvent,
  ref: React.MutableRefObject<DndPayload | null>,
): DndPayload | null {
  const fromTransfer = readDnd(e)
  if (fromTransfer) return fromTransfer
  return ref.current
}

const DND_BODY_KIND_ATTR = 'data-reconfig-dnd-kind'

function setBodyDndKind(kind: 'batch' | 'action' | null) {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!kind) {
    body.removeAttribute(DND_BODY_KIND_ATTR)
    return
  }
  body.setAttribute(DND_BODY_KIND_ATTR, kind)
}

function isBatchPayload(p: DndPayload): boolean {
  return p.t === 'palette-batch' || p.t === 'move-batch'
}

function isActionPayload(p: DndPayload): boolean {
  return p.t === 'palette-action' || p.t === 'move-action'
}

function batchCardClass(criticality: BatchCriticality): string {
  const base = 'reconfig-builder__batch'
  switch (criticality) {
    case 'CRITICAL':
      return `${base} reconfig-builder__batch--critical`
    case 'OPTIONAL':
      return `${base} reconfig-builder__batch--optional`
    default:
      return `${base} reconfig-builder__batch--normal`
  }
}

function buildPayload(
  batches: DraftBatch[],
): { ok: true; body: ReconfigurationTaskCreateRequest } | { ok: false; error: string } {
  if (batches.length === 0) {
    return { ok: false, error: 'Добавьте хотя бы один пакет.' }
  }
  for (let i = 0; i < batches.length; i++) {
    if (batches[i].actions.length === 0) {
      return {
        ok: false,
        error: `Пакет ${i + 1} пустой: перетащите в него действия или удалите пакет.`,
      }
    }
  }

  const apiActions: ReconfigurationVlanActionCreatePayload[][] = []

  for (const batch of batches) {
    const row: ReconfigurationVlanActionCreatePayload[] = []
    for (const a of batch.actions) {
      if (!isValidUuid(a.deviceId)) {
        return {
          ok: false,
          error: `Укажите корректный UUID устройства для действия «${ACTION_LABEL[a.actionType]}».`,
        }
      }
      if (!isValidUuid(a.id)) {
        return { ok: false, error: 'Некорректный UUID действия (внутренняя ошибка).' }
      }

      switch (a.actionType) {
        case 'ADD_VLAN': {
          const vlanId = parsePositiveInt(a.vlanId)
          if (vlanId == null) {
            return { ok: false, error: 'Для «Добавить VLAN» укажите VLAN ID (0–4094).' }
          }
          row.push({
            actionType: 'ADD_VLAN',
            id: a.id.trim(),
            deviceId: a.deviceId.trim(),
            status: 'PENDING',
            params: { vlanId, name: a.name.trim() },
          })
          break
        }
        case 'DELETE_VLAN': {
          const vlanId = parsePositiveInt(a.vlanId)
          if (vlanId == null) {
            return { ok: false, error: 'Для «Удалить VLAN» укажите VLAN ID.' }
          }
          row.push({
            actionType: 'DELETE_VLAN',
            id: a.id.trim(),
            deviceId: a.deviceId.trim(),
            status: 'PENDING',
            params: { vlanId },
          })
          break
        }
        case 'SET_ACCESS': {
          const vlanId = parsePositiveInt(a.vlanId)
          if (!a.port.trim()) {
            return { ok: false, error: 'Для Access укажите порт.' }
          }
          if (vlanId == null) {
            return { ok: false, error: 'Для Access укажите VLAN ID.' }
          }
          const prevAllowed = [...a.previousAllowedVlanIds].sort((x, y) => x - y)
          if (prevAllowed.length === 0) {
            return {
              ok: false,
              error:
                'Для Access укажите в «Было» хотя бы один VLAN в trunk (previous_state).',
            }
          }
          row.push({
            actionType: 'SET_ACCESS',
            id: a.id.trim(),
            deviceId: a.deviceId.trim(),
            status: 'PENDING',
            params: { port: a.port.trim(), vlanId },
            previousState: { mode: 'TRUNK', allowedVlans: prevAllowed },
            targetState: { mode: 'ACCESS', vlanId },
          })
          break
        }
        case 'SET_TRUNK': {
          if (!a.port.trim()) {
            return { ok: false, error: 'Для Trunk укажите порт.' }
          }
          const allowed = [...a.allowedVlanIds].sort((x, y) => x - y)
          if (allowed.length === 0) {
            return {
              ok: false,
              error: 'Для Trunk добавьте хотя бы один разрешённый VLAN из списка.',
            }
          }
          let nativeVlanId: number | null = null
          if (a.nativeVlanId.trim()) {
            const n = parsePositiveInt(a.nativeVlanId)
            if (n == null) {
              return { ok: false, error: 'Native VLAN: неверное число.' }
            }
            nativeVlanId = n
          }
          const prevAccessVlan = parsePositiveInt(a.previousAccessVlanId)
          if (prevAccessVlan == null) {
            return {
              ok: false,
              error: 'Для Trunk укажите VLAN access до изменения (previous_state).',
            }
          }
          row.push({
            actionType: 'SET_TRUNK',
            id: a.id.trim(),
            deviceId: a.deviceId.trim(),
            status: 'PENDING',
            params: {
              port: a.port.trim(),
              allowedVlans: allowed,
              nativeVlanId,
            },
            previousState: { mode: 'ACCESS', vlanId: prevAccessVlan },
            targetState: { mode: 'TRUNK', allowedVlans: allowed },
          })
          break
        }
        case 'SWITCH_VLAN': {
          const targetVlanId = parsePositiveInt(a.targetVlanId)
          const prevVlanId = parsePositiveInt(a.previousVlanId)
          if (!a.port.trim()) {
            return { ok: false, error: 'Для смены VLAN укажите порт.' }
          }
          if (targetVlanId == null) {
            return { ok: false, error: 'Укажите целевой VLAN ID.' }
          }
          if (prevVlanId == null) {
            return {
              ok: false,
              error: 'Укажите исходный VLAN до переключения (previous_state).',
            }
          }
          row.push({
            actionType: 'SWITCH_VLAN',
            id: a.id.trim(),
            deviceId: a.deviceId.trim(),
            status: 'PENDING',
            params: { port: a.port.trim(), targetVlanId },
            previousState: { vlanId: prevVlanId },
            targetState: { vlanId: targetVlanId },
          })
          break
        }
      }
    }
    apiActions.push(row)
  }

  const body: ReconfigurationTaskCreateRequest = {
    status: 'PENDING',
    batches: batches.map((b, i) => ({
      id: b.id,
      criticality: b.criticality,
      status: 'PENDING',
      actions: apiActions[i],
    })),
  }
  return { ok: true, body }
}

function updateActionInPlace(
  batches: DraftBatch[],
  batchIndex: number,
  actionIndex: number,
  patch: Partial<DraftAction>,
): DraftBatch[] {
  return batches.map((b, bi) => {
    if (bi !== batchIndex) return b
    return {
      ...b,
      actions: b.actions.map((act, ai) => {
        if (ai !== actionIndex) return act
        return { ...act, ...patch } as DraftAction
      }),
    }
  })
}

function deviceLabel(d: NetworkDevice): string {
  return `${d.hostname} (${d.mgmtIp})`
}

function sortVlans(vlans: Vlan[]): Vlan[] {
  return [...vlans].sort((a, b) => a.vlanId - b.vlanId)
}

function vlanFromVlanIdString(vlans: Vlan[], vlanIdStr: string): Vlan | undefined {
  const n = Number.parseInt(vlanIdStr.trim(), 10)
  if (!Number.isFinite(n)) return undefined
  return vlans.find((v) => v.vlanId === n)
}

function useDeviceInterfaces(deviceId: string) {
  const [list, setList] = useState<DeviceInterface[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [ifaceErr, setIfaceErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isValidUuid(deviceId.trim())) {
      setList(null)
      setIfaceErr(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setIfaceErr(null)
    void fetchInterfacesForDevice(deviceId.trim())
      .then((ifaces) => {
        if (!cancelled) setList(ifaces)
      })
      .catch((e) => {
        if (!cancelled) {
          setList(null)
          setIfaceErr(e instanceof Error ? e.message : String(e))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  return { list, loading, ifaceErr }
}

/**
 * Подставляет previous_* из каталога (interface_vlan + trunk_allowed_vlan), когда выбран порт из списка.
 */
function useInventoryPreviousFromCatalog(
  actionType: ReconfigurationActionType,
  deviceId: string,
  port: string,
  ifaceList: DeviceInterface[] | null,
  onPatch: (patch: Partial<DraftAction>) => void,
) {
  const lastKeyRef = useRef('')
  useEffect(() => {
    if (
      actionType !== 'SET_ACCESS' &&
      actionType !== 'SET_TRUNK' &&
      actionType !== 'SWITCH_VLAN'
    ) {
      return
    }
    if (!ifaceList) return
    const p = port.trim()
    if (!p) {
      lastKeyRef.current = ''
      return
    }
    const key = `${deviceId.trim()}|${p}`
    if (lastKeyRef.current === key) return
    const iface = ifaceList.find((i) => i.name === p)
    if (!iface) return
    const b = iface.vlanBinding
    const trunkIds = b?.trunkAllowedVlanIds ?? []
    let patch: Partial<DraftAction> | undefined
    if (actionType === 'SET_ACCESS') {
      if (b?.mode === 'TRUNK' && trunkIds.length > 0) {
        patch = { previousAllowedVlanIds: [...trunkIds].sort((a, c) => a - c) }
      }
    } else if (actionType === 'SET_TRUNK') {
      if (b?.mode === 'ACCESS' && b.accessVlanId != null) {
        patch = { previousAccessVlanId: String(b.accessVlanId) }
      }
    } else if (actionType === 'SWITCH_VLAN') {
      if (b?.mode === 'ACCESS' && b.accessVlanId != null) {
        patch = { previousVlanId: String(b.accessVlanId) }
      }
    }
    if (patch) {
      lastKeyRef.current = key
      onPatch(patch)
    }
  }, [actionType, deviceId, port, ifaceList, onPatch])
}

const DeviceSelect = memo(function DeviceSelect({
  value,
  devices,
  onChange,
}: {
  value: string
  devices: NetworkDevice[]
  onChange: (deviceId: string) => void
}) {
  const id = value.trim()
  const known = devices.find((d) => d.id === id)
  const selectValue = known ? id : isValidUuid(id) ? id : ''

  return (
    <label className="reconfig-builder__field">
      <span>Устройство</span>
      <select
        className="reconfig-builder__select"
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— выберите устройство —</option>
        {!known && isValidUuid(id) ? (
          <option value={id}>
            {id.slice(0, 8)}… (нет в каталоге)
          </option>
        ) : null}
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {deviceLabel(d)}
          </option>
        ))}
      </select>
    </label>
  )
})

const PortSelect = memo(function PortSelect({
  deviceId,
  port,
  onChange,
  ifacesState,
}: {
  deviceId: string
  port: string
  onChange: (port: string) => void
  /** Общая загрузка интерфейсов (без второго GET на то же устройство). */
  ifacesState?: {
    list: DeviceInterface[] | null
    loading: boolean
    ifaceErr: string | null
  }
}) {
  const internal = useDeviceInterfaces(ifacesState !== undefined ? '' : deviceId)
  const list = ifacesState !== undefined ? ifacesState.list : internal.list
  const loading = ifacesState !== undefined ? ifacesState.loading : internal.loading
  const ifaceErr = ifacesState !== undefined ? ifacesState.ifaceErr : internal.ifaceErr
  const names = new Set((list ?? []).map((i) => i.name))
  const p = port.trim()
  const orphan = p && !names.has(p)

  const sorted = list
    ? [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    : []

  return (
    <label className="reconfig-builder__field">
      <span>Порт</span>
      <select
        className="reconfig-builder__select"
        value={orphan ? p : p && names.has(p) ? p : ''}
        disabled={!isValidUuid(deviceId.trim())}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— выберите порт —</option>
        {orphan ? (
          <option value={p}>
            {p} (не из списка)
          </option>
        ) : null}
        {sorted.map((i) => (
          <option key={i.id} value={i.name}>
            {i.name}
          </option>
        ))}
      </select>
      {loading ? (
        <span className="reconfig-builder__field-note">Загрузка портов…</span>
      ) : null}
      {ifaceErr ? (
        <span className="reconfig-builder__field-note reconfig-builder__field-note--err">
          {ifaceErr}
        </span>
      ) : null}
    </label>
  )
})

const AllowedVlanPicker = memo(function AllowedVlanPicker({
  vlans,
  selected,
  onChange,
}: {
  vlans: Vlan[]
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const sorted = sortVlans(vlans)
  const pool = sorted.filter((v) => !selected.includes(v.vlanId))
  const shown = [...selected].sort((a, b) => a - b)

  return (
    <div className="reconfig-builder__field reconfig-builder__field--full">
      <span>Разрешённые VLAN</span>
      <div className="reconfig-builder__vlan-selected" aria-label="Выбранные VLAN">
        {shown.length === 0 ? (
          <span className="reconfig-builder__muted">Нажмите VLAN ниже, чтобы добавить</span>
        ) : (
          shown.map((vid) => (
            <span key={vid} className="reconfig-builder__vlan-chip">
              <span className="reconfig-builder__vlan-chip-id">{vid}</span>
              <button
                type="button"
                className="reconfig-builder__vlan-chip-remove"
                aria-label={`Исключить VLAN ${vid}`}
                onClick={() => onChange(selected.filter((x) => x !== vid))}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="reconfig-builder__vlan-pool" role="list">
        {pool.length === 0 ? (
          <span className="reconfig-builder__muted">Нет доступных VLAN для добавления</span>
        ) : (
          pool.map((v) => (
            <button
              key={v.vlanId}
              type="button"
              className="reconfig-builder__vlan-pool-item"
              onClick={() => onChange([...selected, v.vlanId])}
            >
              <span className="reconfig-builder__vlan-pool-vid">{v.vlanId}</span>
              {v.name ? (
                <span className="reconfig-builder__vlan-pool-name">{v.name}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
})

type Props = {
  onCancel: () => void
  onCreated: () => void
}

export const ReconfigurationTaskBuilder = memo(function ReconfigurationTaskBuilder({
  onCancel,
  onCreated,
}: Props) {
  const dragPayloadRef = useRef<DndPayload | null>(null)
  const [batches, setBatches] = useState<DraftBatch[]>(() => [emptyBatch('NORMAL')])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dropFlash, setDropFlash] = useState<string | null>(null)
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [inventoryError, setInventoryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchDevices(), fetchVlans()])
      .then(([d, v]) => {
        if (cancelled) return
        setDevices(d)
        setVlans(v)
        setInventoryError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setInventoryError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const beginDrag = useCallback((e: React.DragEvent, payload: DndPayload) => {
    dragPayloadRef.current = payload
    setBodyDndKind(isBatchPayload(payload) ? 'batch' : 'action')
    setDnd(e, payload)
  }, [])

  const endDrag = useCallback(() => {
    dragPayloadRef.current = null
    setBodyDndKind(null)
  }, [])

  useEffect(() => {
    const onWindowDragEnd = () => endDrag()
    window.addEventListener('dragend', onWindowDragEnd, true)
    return () => {
      window.removeEventListener('dragend', onWindowDragEnd, true)
      setBodyDndKind(null)
      dragPayloadRef.current = null
    }
  }, [endDrag])

  const setFlash = useCallback((key: string) => {
    setDropFlash(key)
    window.setTimeout(() => setDropFlash(null), 450)
  }, [])

  const handleDropActionSlot = useCallback(
    (targetBatch: number, slotIndex: number, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const p = readDroppedPayload(e, dragPayloadRef)
      if (!p || !isActionPayload(p)) return
      if (p.t === 'palette-action') {
        setBatches((prev) =>
          insertActionAt(prev, targetBatch, slotIndex, newDraftAction(p.kind)),
        )
        setFlash(`a-${targetBatch}-${slotIndex}`)
        setError(null)
        return
      }
      if (p.t === 'move-action') {
        if (p.batchIndex === targetBatch && p.actionIndex === slotIndex) {
          return
        }
        setBatches((prev) =>
          moveAction(prev, p.batchIndex, p.actionIndex, targetBatch, slotIndex),
        )
        setFlash(`a-${targetBatch}-${slotIndex}`)
        setError(null)
      }
    },
    [setFlash],
  )

  const handleDropBatchSlot = useCallback(
    (slotIndex: number, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const p = readDroppedPayload(e, dragPayloadRef)
      if (!p || !isBatchPayload(p)) return
      if (p.t === 'palette-batch') {
        setBatches((prev) =>
          insertBatchAt(prev, slotIndex, emptyBatch(p.criticality)),
        )
        setFlash(`b-${slotIndex}`)
        setError(null)
        return
      }
      if (p.t === 'move-batch') {
        setBatches((prev) => moveBatchToSlot(prev, p.batchIndex, slotIndex))
        setFlash(`b-${slotIndex}`)
        setError(null)
      }
    },
    [setFlash],
  )

  const removeAction = useCallback((batchIndex: number, actionIndex: number) => {
    setBatches((prev) => removeActionAt(prev, batchIndex, actionIndex))
  }, [])

  const removeBatch = useCallback((batchIndex: number) => {
    setBatches((prev) => {
      if (prev.length <= 1) return prev
      return removeBatchAt(prev, batchIndex)
    })
  }, [])

  const patchBatch = useCallback(
    (batchIndex: number, patch: Partial<Pick<DraftBatch, 'criticality'>>) => {
      setBatches((prev) =>
        prev.map((b, i) => (i === batchIndex ? { ...b, ...patch } : b)),
      )
    },
    [],
  )

  const patchAction = useCallback(
    (batchIndex: number, actionIndex: number, patch: Partial<DraftAction>) => {
      setBatches((prev) =>
        updateActionInPlace(prev, batchIndex, actionIndex, patch),
      )
    },
    [],
  )

  const submit = useCallback(async () => {
    setError(null)
    setSuccess(null)
    const built = buildPayload(batches)
    if (!built.ok) {
      setError(built.error)
      return
    }
    setBusy(true)
    try {
      const created = await createReconfigurationTask(built.body)
      setSuccess(`Задача отправлена в Kafka. Идентификатор: ${created.id}`)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [batches, onCreated])

  const onBatchSlotDragOver = useCallback((e: React.DragEvent) => {
    const p = dragPayloadRef.current
    if (!p || !isBatchPayload(p)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = p.t === 'palette-batch' ? 'copy' : 'move'
  }, [])

  const onActionSlotDragOver = useCallback((e: React.DragEvent) => {
    const p = dragPayloadRef.current
    if (!p || !isActionPayload(p)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = p.t === 'palette-action' ? 'copy' : 'move'
  }, [])

  return (
    <div className="reconfig-builder">
      <aside className="reconfig-builder__palette" aria-label="Шаблоны блоков">
        <div>
          <h2>Пакеты</h2>
          <p className="reconfig-builder__hint">
            Перетащите пакет на полоску между этапами справа, чтобы задать
            критичность нового этапа.
          </p>
        </div>
        <div className="reconfig-builder__templates">
          {BATCH_PALETTE.map((b) => (
            <div
              key={b.criticality}
              className={`reconfig-builder__tpl reconfig-builder__tpl--batch ${b.cls}`.trim()}
              draggable
              tabIndex={0}
              role="button"
              aria-label={`Перетащить шаблон: ${b.title}`}
              onDragStart={(e) =>
                beginDrag(e, { t: 'palette-batch', criticality: b.criticality })
              }
            >
              <span className="reconfig-builder__tpl-title">{b.title}</span>
              <span className="reconfig-builder__tpl-desc">{b.desc}</span>
            </div>
          ))}
        </div>
        <div>
          <h2>Действия</h2>
          <p className="reconfig-builder__hint">
            Перетащите действие в нужный пакет: между карточками или на пустую
            область пакета.
          </p>
        </div>
        <div className="reconfig-builder__templates">
          {ACTION_PALETTE.map((a) => (
            <div
              key={a.kind}
              className="reconfig-builder__tpl"
              draggable
              tabIndex={0}
              role="button"
              aria-label={`Перетащить действие: ${a.title}`}
              onDragStart={(e) =>
                beginDrag(e, { t: 'palette-action', kind: a.kind })
              }
            >
              <span className="reconfig-builder__tpl-title">{a.title}</span>
              <span className="reconfig-builder__tpl-desc">{a.desc}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="reconfig-builder__canvas">
        <div className="reconfig-builder__toolbar">
          <button
            type="button"
            className="reconfig-tasks__btn"
            onClick={onCancel}
            disabled={busy}
          >
            К списку задач
          </button>
          <span className="reconfig-builder__toolbar-spacer" />
          <button
            type="button"
            className="reconfig-builder__btn reconfig-builder__btn--primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Отправка…' : 'Отправить в Kafka'}
          </button>
        </div>

        {error ? (
          <p className="reconfig-builder__msg reconfig-builder__msg--err" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="reconfig-builder__msg reconfig-builder__msg--ok" role="status">
            {success}
          </p>
        ) : null}
        {inventoryError ? (
          <p className="reconfig-builder__msg" role="status">
            Не удалось загрузить каталог устройств и VLAN: {inventoryError}
          </p>
        ) : null}

        <div
          className={`reconfig-builder__drop-slot reconfig-builder__drop-slot--batch reconfig-builder__batch-slot ${
            dropFlash === 'b-0' ? 'reconfig-builder__drop-slot--active' : ''
          }`}
          onDragOver={onBatchSlotDragOver}
          onDrop={(e) => handleDropBatchSlot(0, e)}
        />

        {batches.map((batch, batchIndex) => (
          <div key={batch.id}>
            <article className={batchCardClass(batch.criticality)}>
              <header className="reconfig-builder__batch-head">
                <span
                  className="reconfig-builder__batch-grip"
                  draggable
                  onDragStart={(e) => {
                    beginDrag(e, { t: 'move-batch', batchIndex })
                  }}
                  title="Перенести пакет"
                  aria-hidden
                >
                  ⋮⋮
                </span>
                <span className="reconfig-builder__batch-title">
                  Пакет {batchIndex + 1}
                </span>
                <div className="reconfig-builder__batch-meta">
                  <label>
                    Критичность
                    <select
                      value={batch.criticality}
                      onChange={(e) =>
                        patchBatch(batchIndex, {
                          criticality: e.target.value as BatchCriticality,
                        })
                      }
                    >
                      <option value="CRITICAL">Критичный</option>
                      <option value="NORMAL">Обычный</option>
                      <option value="OPTIONAL">Опциональный</option>
                    </select>
                  </label>
                  <span className="reconfig-builder__id-note" title={batch.id}>
                    id: {batch.id}
                  </span>
                  <button
                    type="button"
                    className="reconfig-builder__btn reconfig-builder__btn--danger"
                    onClick={() => removeBatch(batchIndex)}
                    disabled={batches.length <= 1}
                  >
                    Удалить пакет
                  </button>
                </div>
              </header>
              <div className="reconfig-builder__batch-body">
                <div
                  className={`reconfig-builder__drop-slot reconfig-builder__drop-slot--action ${
                    dropFlash === `a-${batchIndex}-0`
                      ? 'reconfig-builder__drop-slot--active'
                      : ''
                  }`}
                  onDragOver={onActionSlotDragOver}
                  onDrop={(e) => handleDropActionSlot(batchIndex, 0, e)}
                />
                {batch.actions.length === 0 ? (
                  <div
                    className="reconfig-builder__empty-batch reconfig-builder__empty-batch--drop-target"
                    onDragOver={onActionSlotDragOver}
                    onDrop={(e) => handleDropActionSlot(batchIndex, 0, e)}
                  >
                    Пустой пакет — перетащите сюда действие слева.
                  </div>
                ) : null}
                {batch.actions.map((action, actionIndex) => (
                  <div key={action.rowKey}>
                    <div className="reconfig-builder__action">
                      <div className="reconfig-builder__action-head">
                        <span
                          className="reconfig-builder__action-grip"
                          draggable
                          onDragStart={(e) =>
                            beginDrag(e, {
                              t: 'move-action',
                              batchIndex,
                              actionIndex,
                            })
                          }
                          title="Перенести действие"
                          aria-hidden
                        >
                          ⋮⋮
                        </span>
                        <span className="reconfig-builder__action-type">
                          {ACTION_LABEL[action.actionType]}
                        </span>
                        <button
                          type="button"
                          className="reconfig-builder__btn reconfig-builder__btn--danger"
                          onClick={() => removeAction(batchIndex, actionIndex)}
                        >
                          Удалить
                        </button>
                      </div>
                      <ActionFields
                        action={action}
                        devices={devices}
                        vlans={vlans}
                        onPatch={(patch) =>
                          patchAction(batchIndex, actionIndex, patch)
                        }
                      />
                    </div>
                    <div
                      className={`reconfig-builder__drop-slot reconfig-builder__drop-slot--action ${
                        dropFlash === `a-${batchIndex}-${actionIndex + 1}`
                          ? 'reconfig-builder__drop-slot--active'
                          : ''
                      }`}
                      onDragOver={onActionSlotDragOver}
                      onDrop={(e) =>
                        handleDropActionSlot(batchIndex, actionIndex + 1, e)
                      }
                    />
                  </div>
                ))}
              </div>
            </article>

            <div
              className={`reconfig-builder__drop-slot reconfig-builder__drop-slot--batch reconfig-builder__batch-slot ${
                dropFlash === `b-${batchIndex + 1}`
                  ? 'reconfig-builder__drop-slot--active'
                  : ''
              }`}
              onDragOver={onBatchSlotDragOver}
              onDrop={(e) => handleDropBatchSlot(batchIndex + 1, e)}
            />
          </div>
        ))}
      </div>
    </div>
  )
})

type FieldProps = {
  action: DraftAction
  devices: NetworkDevice[]
  vlans: Vlan[]
  onPatch: (patch: Partial<DraftAction>) => void
}

const ActionFields = memo(function ActionFields({
  action,
  devices,
  vlans,
  onPatch,
}: FieldProps) {
  const sortedVlans = sortVlans(vlans)
  const loadPortIfaces =
    action.actionType === 'SET_ACCESS' ||
    action.actionType === 'SET_TRUNK' ||
    action.actionType === 'SWITCH_VLAN'
  const devId = action.deviceId
  const ifaceState = useDeviceInterfaces(
    loadPortIfaces && isValidUuid(devId.trim()) ? devId : '',
  )
  const sharedIfaces = loadPortIfaces
    ? { list: ifaceState.list, loading: ifaceState.loading, ifaceErr: ifaceState.ifaceErr }
    : undefined
  const portForInventory = loadPortIfaces ? action.port : ''
  useInventoryPreviousFromCatalog(
    action.actionType,
    devId,
    portForInventory,
    ifaceState.list,
    onPatch,
  )

  switch (action.actionType) {
    case 'ADD_VLAN': {
      const fromCat = vlanFromVlanIdString(vlans, action.vlanId)
      return (
        <div className="reconfig-builder__action-fields">
          <label className="reconfig-builder__field">
            <span>ID действия (UUID)</span>
            <input
              value={action.id}
              onChange={(e) => onPatch({ id: e.target.value })}
              autoComplete="off"
            />
          </label>
          <DeviceSelect
            value={action.deviceId}
            devices={devices}
            onChange={(deviceId) => onPatch({ deviceId })}
          />
          <label className="reconfig-builder__field">
            <span>VLAN из каталога</span>
            <select
              className="reconfig-builder__select"
              value={fromCat ? String(fromCat.vlanId) : ''}
              onChange={(e) => {
                const vid = e.target.value
                if (!vid) {
                  onPatch({ vlanId: '', name: '' })
                  return
                }
                const v = vlans.find((x) => String(x.vlanId) === vid)
                if (v) {
                  onPatch({ vlanId: String(v.vlanId), name: v.name ?? '' })
                }
              }}
            >
              <option value="">— не из списка —</option>
              {sortedVlans.map((v) => (
                <option key={v.vlanId} value={String(v.vlanId)}>
                  {v.vlanId}
                  {v.name ? ` — ${v.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="reconfig-builder__field">
            <span>VLAN ID (вручную)</span>
            <input
              value={action.vlanId}
              onChange={(e) => onPatch({ vlanId: e.target.value })}
              inputMode="numeric"
              placeholder="0–4094"
            />
          </label>
          <label className="reconfig-builder__field reconfig-builder__field--full">
            <span>Имя VLAN (необязательно)</span>
            <input
              value={action.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </label>
        </div>
      )
    }
    case 'DELETE_VLAN': {
      const vidStr = action.vlanId.trim()
      const inList = sortedVlans.some((v) => String(v.vlanId) === vidStr)
      return (
        <div className="reconfig-builder__action-fields">
          <label className="reconfig-builder__field">
            <span>ID действия (UUID)</span>
            <input
              value={action.id}
              onChange={(e) => onPatch({ id: e.target.value })}
            />
          </label>
          <DeviceSelect
            value={action.deviceId}
            devices={devices}
            onChange={(deviceId) => onPatch({ deviceId })}
          />
          <label className="reconfig-builder__field">
            <span>VLAN</span>
            <select
              className="reconfig-builder__select"
              value={inList ? vidStr : ''}
              onChange={(e) => onPatch({ vlanId: e.target.value })}
            >
              <option value="">— выберите VLAN —</option>
              {sortedVlans.map((v) => (
                <option key={v.vlanId} value={String(v.vlanId)}>
                  {v.vlanId}
                  {v.name ? ` — ${v.name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )
    }
    case 'SET_ACCESS': {
      const fromCat = vlanFromVlanIdString(vlans, action.vlanId)
      return (
        <div className="reconfig-builder__action-fields">
          <label className="reconfig-builder__field">
            <span>ID действия (UUID)</span>
            <input
              value={action.id}
              onChange={(e) => onPatch({ id: e.target.value })}
            />
          </label>
          <DeviceSelect
            value={action.deviceId}
            devices={devices}
            onChange={(deviceId) =>
              onPatch({ deviceId, port: '', previousAllowedVlanIds: [] })
            }
          />
          <PortSelect
            deviceId={action.deviceId}
            port={action.port}
            onChange={(port) => onPatch({ port })}
            ifacesState={sharedIfaces}
          />
          <label className="reconfig-builder__field">
            <span>VLAN из каталога</span>
            <select
              className="reconfig-builder__select"
              value={fromCat ? String(fromCat.vlanId) : ''}
              onChange={(e) => {
                const vid = e.target.value
                if (!vid) {
                  onPatch({ vlanId: '' })
                  return
                }
                const v = vlans.find((x) => String(x.vlanId) === vid)
                if (v) onPatch({ vlanId: String(v.vlanId) })
              }}
            >
              <option value="">— не из списка —</option>
              {sortedVlans.map((v) => (
                <option key={v.vlanId} value={String(v.vlanId)}>
                  {v.vlanId}
                  {v.name ? ` — ${v.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="reconfig-builder__field">
            <span>VLAN ID (вручную)</span>
            <input
              value={action.vlanId}
              onChange={(e) => onPatch({ vlanId: e.target.value })}
              inputMode="numeric"
            />
          </label>
          <div className="reconfig-builder__state-row">
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Было · previous_state</span>
              <p className="reconfig-builder__state-hint">
                Порт в trunk: разрешённые VLAN до перевода в access. При выборе порта из каталога
                список подставляется из БД (trunk_allowed_vlan), если порт сейчас в режиме trunk.
              </p>
              <AllowedVlanPicker
                vlans={vlans}
                selected={action.previousAllowedVlanIds}
                onChange={(previousAllowedVlanIds) => onPatch({ previousAllowedVlanIds })}
              />
            </div>
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Станет · target_state</span>
              <pre className="reconfig-builder__state-json" aria-label="target_state">
                {(() => {
                  const vid = parsePositiveInt(action.vlanId)
                  if (vid == null) {
                    return '— укажите целевой VLAN выше —'
                  }
                  return JSON.stringify({ mode: 'ACCESS', vlanId: vid }, null, 2)
                })()}
              </pre>
            </div>
          </div>
        </div>
      )
    }
    case 'SET_TRUNK': {
      const nStr = action.nativeVlanId.trim()
      const nativeInCatalog = nStr
        ? sortedVlans.some((v) => String(v.vlanId) === nStr)
        : false
      const nativeSelectValue =
        nStr === '' ? '' : nativeInCatalog || parsePositiveInt(nStr) != null ? nStr : ''
      const fromPrevCat = vlanFromVlanIdString(vlans, action.previousAccessVlanId)
      return (
        <div className="reconfig-builder__action-fields">
          <label className="reconfig-builder__field">
            <span>ID действия (UUID)</span>
            <input
              value={action.id}
              onChange={(e) => onPatch({ id: e.target.value })}
            />
          </label>
          <DeviceSelect
            value={action.deviceId}
            devices={devices}
            onChange={(deviceId) =>
              onPatch({ deviceId, port: '', previousAccessVlanId: '' })
            }
          />
          <PortSelect
            deviceId={action.deviceId}
            port={action.port}
            onChange={(port) => onPatch({ port })}
            ifacesState={sharedIfaces}
          />
          <AllowedVlanPicker
            vlans={vlans}
            selected={action.allowedVlanIds}
            onChange={(allowedVlanIds) => onPatch({ allowedVlanIds })}
          />
          <label className="reconfig-builder__field">
            <span>Native VLAN</span>
            <select
              className="reconfig-builder__select"
              value={nativeSelectValue}
              onChange={(e) => onPatch({ nativeVlanId: e.target.value })}
            >
              <option value="">— не задан —</option>
              {!nativeInCatalog && nStr && parsePositiveInt(nStr) != null ? (
                <option value={nStr}>
                  {nStr} (не в каталоге)
                </option>
              ) : null}
              {sortedVlans.map((v) => (
                <option key={v.vlanId} value={String(v.vlanId)}>
                  {v.vlanId}
                  {v.name ? ` — ${v.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="reconfig-builder__state-row">
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Было · previous_state</span>
              <p className="reconfig-builder__state-hint">
                Порт в access на одном VLAN до перевода в trunk. Если в БД порт в режиме access,
                VLAN подставляется из interface_vlan.access_vlan_id.
              </p>
              <label className="reconfig-builder__field">
                <span>VLAN из каталога</span>
                <select
                  className="reconfig-builder__select"
                  value={fromPrevCat ? String(fromPrevCat.vlanId) : ''}
                  onChange={(e) => {
                    const vid = e.target.value
                    if (!vid) {
                      onPatch({ previousAccessVlanId: '' })
                      return
                    }
                    const v = vlans.find((x) => String(x.vlanId) === vid)
                    if (v) onPatch({ previousAccessVlanId: String(v.vlanId) })
                  }}
                >
                  <option value="">— не из списка —</option>
                  {sortedVlans.map((v) => (
                    <option key={v.vlanId} value={String(v.vlanId)}>
                      {v.vlanId}
                      {v.name ? ` — ${v.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reconfig-builder__field">
                <span>VLAN ID (вручную)</span>
                <input
                  value={action.previousAccessVlanId}
                  onChange={(e) => onPatch({ previousAccessVlanId: e.target.value })}
                  inputMode="numeric"
                />
              </label>
            </div>
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Станет · target_state</span>
              <pre className="reconfig-builder__state-json" aria-label="target_state">
                {(() => {
                  const allowed = [...action.allowedVlanIds].sort((x, y) => x - y)
                  if (allowed.length === 0) {
                    return '— задайте разрешённые VLAN выше —'
                  }
                  return JSON.stringify(
                    { mode: 'TRUNK', allowedVlans: allowed },
                    null,
                    2,
                  )
                })()}
              </pre>
            </div>
          </div>
        </div>
      )
    }
    case 'SWITCH_VLAN': {
      const fromCat = vlanFromVlanIdString(vlans, action.targetVlanId)
      const fromPrevCat = vlanFromVlanIdString(vlans, action.previousVlanId)
      return (
        <div className="reconfig-builder__action-fields">
          <label className="reconfig-builder__field">
            <span>ID действия (UUID)</span>
            <input
              value={action.id}
              onChange={(e) => onPatch({ id: e.target.value })}
            />
          </label>
          <DeviceSelect
            value={action.deviceId}
            devices={devices}
            onChange={(deviceId) =>
              onPatch({ deviceId, port: '', previousVlanId: '' })
            }
          />
          <PortSelect
            deviceId={action.deviceId}
            port={action.port}
            onChange={(port) => onPatch({ port })}
            ifacesState={sharedIfaces}
          />
          <label className="reconfig-builder__field">
            <span>Целевой VLAN из каталога</span>
            <select
              className="reconfig-builder__select"
              value={fromCat ? String(fromCat.vlanId) : ''}
              onChange={(e) => {
                const vid = e.target.value
                if (!vid) {
                  onPatch({ targetVlanId: '' })
                  return
                }
                const v = vlans.find((x) => String(x.vlanId) === vid)
                if (v) onPatch({ targetVlanId: String(v.vlanId) })
              }}
            >
              <option value="">— не из списка —</option>
              {sortedVlans.map((v) => (
                <option key={v.vlanId} value={String(v.vlanId)}>
                  {v.vlanId}
                  {v.name ? ` — ${v.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="reconfig-builder__field">
            <span>Целевой VLAN ID (вручную)</span>
            <input
              value={action.targetVlanId}
              onChange={(e) => onPatch({ targetVlanId: e.target.value })}
              inputMode="numeric"
            />
          </label>
          <div className="reconfig-builder__state-row">
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Было · previous_state</span>
              <p className="reconfig-builder__state-hint">
                Текущий VLAN на access-порту. При выборе порта из каталога подставляется из
                interface_vlan.access_vlan_id, если режим access.
              </p>
              <label className="reconfig-builder__field">
                <span>VLAN из каталога</span>
                <select
                  className="reconfig-builder__select"
                  value={fromPrevCat ? String(fromPrevCat.vlanId) : ''}
                  onChange={(e) => {
                    const vid = e.target.value
                    if (!vid) {
                      onPatch({ previousVlanId: '' })
                      return
                    }
                    const v = vlans.find((x) => String(x.vlanId) === vid)
                    if (v) onPatch({ previousVlanId: String(v.vlanId) })
                  }}
                >
                  <option value="">— не из списка —</option>
                  {sortedVlans.map((v) => (
                    <option key={v.vlanId} value={String(v.vlanId)}>
                      {v.vlanId}
                      {v.name ? ` — ${v.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reconfig-builder__field">
                <span>VLAN ID (вручную)</span>
                <input
                  value={action.previousVlanId}
                  onChange={(e) => onPatch({ previousVlanId: e.target.value })}
                  inputMode="numeric"
                />
              </label>
            </div>
            <div className="reconfig-builder__state-col">
              <span className="reconfig-builder__state-col-title">Станет · target_state</span>
              <pre className="reconfig-builder__state-json" aria-label="target_state">
                {(() => {
                  const vid = parsePositiveInt(action.targetVlanId)
                  if (vid == null) {
                    return '— укажите целевой VLAN выше —'
                  }
                  return JSON.stringify({ vlanId: vid }, null, 2)
                })()}
              </pre>
            </div>
          </div>
        </div>
      )
    }
  }
})
