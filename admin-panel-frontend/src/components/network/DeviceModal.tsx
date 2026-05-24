import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  addTrunkAllowedVlan,
  createDevice,
  createDeviceInterface,
  deleteDeviceInterface,
  deleteInterfaceVlan,
  fetchInterfacesForDevice,
  fetchVlans,
  listTrunkAllowedVlans,
  removeTrunkAllowedVlan,
  updateDevice,
  updateDeviceInterface,
  upsertInterfaceVlan,
} from '../../api/networkClient'
import type {
  DeviceInterface,
  DeviceInterfaceVlanBinding,
  DeviceType,
  Link,
  NetworkDevice,
  NetworkDeviceStatus,
  Vlan,
} from '../../types/network'
import {
  buildInetCidr,
  formatIpv4WhileTyping,
  isValidIpv4Dotted,
  parseMaskBits,
  splitHostAndCidrMask,
} from '../../utils/ipv4Cidr'
import { formatPhysicalL2Summary } from '../../utils/portVlanLabels'
import './DeviceModal.css'

type Mode = 'create' | 'edit'

type FormState = {
  deviceType: DeviceType
  hostname: string
  mgmtIp: string
  status: NetworkDeviceStatus
}

type L2EditState = {
  mode: 'none' | 'access' | 'trunk'
  accessVlanId: string
  nativeVlanId: string
  trunkAllowedCsv: string
}

type EditRow = {
  id: string
  name: string
  adminStatus: 'UP' | 'DOWN'
  dot1qVlanId: string
  ipv4: string
  maskBits: string
  /** Режим access/trunk на физическом порту */
  l2?: L2EditState
}

const defaultForm = (): FormState => ({
  deviceType: 'SWITCH',
  hostname: '',
  mgmtIp: '',
  status: 'ACTIVE',
})

function formFromDevice(d: NetworkDevice): FormState {
  const { host } = splitHostAndCidrMask(d.mgmtIp)
  return {
    deviceType: d.deviceType,
    hostname: d.hostname,
    mgmtIp: host,
    status: d.status,
  }
}

function sortInterfacesForDisplay(list: DeviceInterface[]): DeviceInterface[] {
  const roots = list
    .filter((i) => !i.parentInterfaceId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const out: DeviceInterface[] = []
  const seen = new Set<string>()
  for (const r of roots) {
    out.push(r)
    seen.add(r.id)
    const children = list
      .filter((i) => i.parentInterfaceId === r.id)
      .sort(
        (a, b) =>
          (a.dot1qVlanId ?? 0) - (b.dot1qVlanId ?? 0) ||
          a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
    for (const c of children) {
      out.push(c)
      seen.add(c.id)
    }
  }
  for (const i of list) {
    if (!seen.has(i.id)) out.push(i)
  }
  return out
}

function parentName(
  iface: DeviceInterface,
  byId: Map<string, DeviceInterface>,
): string {
  if (!iface.parentInterfaceId) return '—'
  return byId.get(iface.parentInterfaceId)?.name ?? iface.parentInterfaceId
}

function parseVlanIdList(csv: string): number[] {
  const out: number[] = []
  for (const part of csv.split(/[,;\s]+/)) {
    const t = part.trim()
    if (!t) continue
    const n = Number(t)
    if (!Number.isInteger(n) || n < 1 || n > 4094) {
      throw new Error(`Некорректный VLAN в списке: «${t}» (ожидается 1–4094)`)
    }
    out.push(n)
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

async function applyPhysicalPortL2(
  interfaceId: string,
  prevBinding: DeviceInterfaceVlanBinding | null | undefined,
  l2: L2EditState,
): Promise<void> {
  const prev = prevBinding ?? null
  if (l2.mode === 'none') {
    const cur = await listTrunkAllowedVlans(interfaceId)
    for (const e of cur) {
      await removeTrunkAllowedVlan(interfaceId, e.vlanId)
    }
    if (prev) {
      await deleteInterfaceVlan(interfaceId)
    }
    return
  }

  if (l2.mode === 'access') {
    const cur = await listTrunkAllowedVlans(interfaceId)
    for (const e of cur) {
      await removeTrunkAllowedVlan(interfaceId, e.vlanId)
    }
    const vid = Number(l2.accessVlanId)
    if (!Number.isInteger(vid) || l2.accessVlanId.trim() === '') {
      throw new Error('Укажите access VLAN.')
    }
    await upsertInterfaceVlan(interfaceId, {
      mode: 'ACCESS',
      accessVlanId: vid,
    })
    return
  }

  const nativeRaw = l2.nativeVlanId.trim()
  let nativeVlanId: number | null = null
  if (nativeRaw !== '') {
    const nativeN = Number(nativeRaw)
    if (!Number.isInteger(nativeN) || nativeN < 1 || nativeN > 4094) {
      throw new Error('Native VLAN: целое число 1–4094 или оставьте пустым.')
    }
    nativeVlanId = nativeN
  }
  await upsertInterfaceVlan(interfaceId, {
    mode: 'TRUNK',
    nativeVlanId,
  })
  let want: Set<number>
  try {
    want = new Set(parseVlanIdList(l2.trunkAllowedCsv))
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e))
  }
  const curList = await listTrunkAllowedVlans(interfaceId)
  const curSet = new Set(curList.map((c) => c.vlanId))
  for (const v of curSet) {
    if (!want.has(v)) {
      await removeTrunkAllowedVlan(interfaceId, v)
    }
  }
  for (const v of want) {
    if (!curSet.has(v)) {
      await addTrunkAllowedVlan(interfaceId, v)
    }
  }
}

export type DeviceModalLinkContext = {
  links: Link[]
  allInterfaces: DeviceInterface[]
  devices: NetworkDevice[]
}

/** Текст «hostname · порт» для удалённого конца линка(ов), или null если нет линка */
function formatPortPeers(
  interfaceId: string,
  ctx: DeviceModalLinkContext | undefined,
): string | null {
  if (!ctx) return null
  const ifaceById = new Map(ctx.allInterfaces.map((i) => [i.id, i]))
  const deviceById = new Map(ctx.devices.map((d) => [d.id, d]))
  const parts: string[] = []
  for (const link of ctx.links) {
    let otherId: string | null = null
    if (link.interfaceAId === interfaceId) otherId = link.interfaceBId
    else if (link.interfaceBId === interfaceId) otherId = link.interfaceAId
    else continue
    const oi = ifaceById.get(otherId)
    if (!oi) continue
    const od = deviceById.get(oi.deviceId)
    const host = od?.hostname ?? oi.deviceId
    parts.push(`${host} · ${oi.name}`)
  }
  if (parts.length === 0) return null
  return parts.join('; ')
}

type Props = {
  mode: Mode
  device: NetworkDevice | null
  open: boolean
  onClose: () => void
  onSaved: (device: NetworkDevice) => void
  onPortsChanged?: () => void
  /** Для отображения второго конца линка в списке портов */
  linkContext?: DeviceModalLinkContext
  /** При создании — зафиксировать тип (вкладки маршрутизаторов / коммутаторов) */
  fixedDeviceType?: DeviceType
}

export function DeviceModal({
  mode,
  device,
  open,
  onClose,
  onSaved,
  onPortsChanged,
  linkContext,
  fixedDeviceType,
}: Props) {
  const titleId = useId()
  const portsSectionId = useId()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ports, setPorts] = useState<DeviceInterface[]>([])
  const [portsLoading, setPortsLoading] = useState(false)
  const [portsError, setPortsError] = useState<string | null>(null)
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [vlansLoading, setVlansLoading] = useState(false)
  const [vlansError, setVlansError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<EditRow | null>(null)
  const [newPortName, setNewPortName] = useState('')
  const [newPortAdmin, setNewPortAdmin] = useState<'UP' | 'DOWN'>('UP')
  const [newPortKind, setNewPortKind] = useState<'physical' | 'subif'>('physical')
  const [newParentId, setNewParentId] = useState('')
  const [newVlanId, setNewVlanId] = useState('')
  const [newPortIpv4, setNewPortIpv4] = useState('')
  const [newPortMask, setNewPortMask] = useState('24')
  const [savingNewPort, setSavingNewPort] = useState(false)
  const [savingEditPort, setSavingEditPort] = useState(false)
  const [deletingPortId, setDeletingPortId] = useState<string | null>(null)

  const loadPorts = useCallback(async () => {
    if (!device?.id || mode !== 'edit') return
    setPortsLoading(true)
    setPortsError(null)
    try {
      const list = await fetchInterfacesForDevice(device.id)
      setPorts(sortInterfacesForDisplay(list))
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
      setPorts([])
    } finally {
      setPortsLoading(false)
    }
  }, [device?.id, mode])

  const loadVlansWithSpinner = useCallback(async () => {
    setVlansLoading(true)
    setVlansError(null)
    try {
      const v = await fetchVlans()
      setVlans(v)
    } catch (e) {
      setVlansError(e instanceof Error ? e.message : String(e))
      setVlans([])
    } finally {
      setVlansLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && device) {
      setForm(formFromDevice(device))
    } else {
      const base = defaultForm()
      setForm(
        fixedDeviceType ? { ...base, deviceType: fixedDeviceType } : base,
      )
    }
  }, [open, mode, device, fixedDeviceType])

  useEffect(() => {
    if (!open || mode !== 'edit' || !device) {
      setPorts([])
      setEditRow(null)
      setPortsError(null)
      setNewPortName('')
      setNewPortAdmin('UP')
      setNewPortKind('physical')
      setNewParentId('')
      setNewVlanId('')
      setNewPortIpv4('')
      setNewPortMask('24')
      setVlans([])
      setVlansError(null)
      return
    }
    void loadPorts()
    void loadVlansWithSpinner()
  }, [open, mode, device, loadPorts, loadVlansWithSpinner])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const notifyPortsChanged = useCallback(() => {
    onPortsChanged?.()
  }, [onPortsChanged])

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      const mgmtTrim = form.mgmtIp.trim()
      if (!isValidIpv4Dotted(mgmtTrim)) {
        setError(
          'Некорректный IPv4-адрес управления (ожидаются четыре октета 0–255).',
        )
        return
      }
      setSubmitting(true)
      try {
        if (mode === 'create') {
          const created = await createDevice({
            deviceType: form.deviceType,
            hostname: form.hostname.trim(),
            mgmtIp: mgmtTrim,
            status: form.status,
          })
          onSaved(created)
        } else {
          if (!device) return
          const updated = await updateDevice(device.id, {
            deviceType: form.deviceType,
            hostname: form.hostname.trim(),
            mgmtIp: mgmtTrim,
            status: form.status,
          })
          onSaved(updated)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSubmitting(false)
      }
    },
    [mode, device, form, onSaved],
  )

  const startEdit = useCallback((iface: DeviceInterface) => {
    const { host, maskBits } = splitHostAndCidrMask(iface.ipAddress)
    const isPhysical = !iface.parentInterfaceId
    const b = iface.vlanBinding
    const l2: L2EditState | undefined = isPhysical
      ? {
          mode: !b ? 'none' : b.mode === 'ACCESS' ? 'access' : 'trunk',
          accessVlanId:
            b?.accessVlanId != null ? String(b.accessVlanId) : '',
          nativeVlanId:
            b?.nativeVlanId != null ? String(b.nativeVlanId) : '',
          trunkAllowedCsv: b?.trunkAllowedVlanIds?.length
            ? [...b.trunkAllowedVlanIds].sort((a, z) => a - z).join(', ')
            : '',
        }
      : undefined
    setEditRow({
      id: iface.id,
      name: iface.name,
      adminStatus: iface.adminStatus,
      dot1qVlanId:
        iface.dot1qVlanId != null ? String(iface.dot1qVlanId) : '',
      ipv4: host,
      maskBits,
      l2,
    })
  }, [])

  const cancelEdit = useCallback(() => setEditRow(null), [])

  const saveEdit = useCallback(async () => {
    if (!editRow) return
    const name = editRow.name.trim()
    if (!name) return
    const iface = ports.find((p) => p.id === editRow.id)
    if (!iface) return
    const isSub = Boolean(iface.parentInterfaceId)
    let dot1qVlanId: number | null = null
    if (isSub) {
      const vid = Number(editRow.dot1qVlanId)
      if (!Number.isFinite(vid) || editRow.dot1qVlanId === '') {
        setPortsError('Укажите VLAN для сабинтерфейса.')
        return
      }
      dot1qVlanId = vid
    }
    if (!isSub && editRow.l2) {
      if (editRow.l2.mode === 'access') {
        if (!editRow.l2.accessVlanId.trim()) {
          setPortsError('В режиме access выберите VLAN.')
          return
        }
      }
      if (editRow.l2.mode === 'trunk') {
        try {
          parseVlanIdList(editRow.l2.trunkAllowedCsv)
        } catch (e) {
          setPortsError(e instanceof Error ? e.message : String(e))
          return
        }
      }
    }
    const ipTrim = editRow.ipv4.trim()
    if (ipTrim && !isValidIpv4Dotted(ipTrim)) {
      setPortsError('Некорректный IPv4-адрес (ожидаются четыре октета 0–255).')
      return
    }
    const mRaw = editRow.maskBits.trim()
    if (mRaw !== '') {
      const m = Number.parseInt(mRaw, 10)
      if (!Number.isFinite(m) || m < 1 || m > 32 || String(m) !== mRaw) {
        setPortsError('Маска (CIDR) должна быть целым числом от 1 до 32.')
        return
      }
    }
    const combinedL3 =
      ipTrim ? buildInetCidr(ipTrim, editRow.maskBits) : null
    setSavingEditPort(true)
    setPortsError(null)
    try {
      await updateDeviceInterface(editRow.id, {
        name,
        adminStatus: editRow.adminStatus,
        dot1qVlanId: isSub ? dot1qVlanId : null,
        ipAddress: combinedL3,
      })
      if (!isSub && editRow.l2) {
        await applyPhysicalPortL2(editRow.id, iface.vlanBinding, editRow.l2)
      }
      await loadPorts()
      setEditRow(null)
      notifyPortsChanged()
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingEditPort(false)
    }
  }, [editRow, ports, notifyPortsChanged, loadPorts])

  const removePort = useCallback(
    async (iface: DeviceInterface) => {
      const isPhysical = !iface.parentInterfaceId
      const msg = isPhysical
        ? `Удалить порт «${iface.name}»? Связанные линки будут удалены; сабинтерфейсы этого порта тоже удалятся.`
        : `Удалить сабинтерфейс «${iface.name}»?`
      if (!window.confirm(msg)) {
        return
      }
      setDeletingPortId(iface.id)
      setPortsError(null)
      try {
        await deleteDeviceInterface(iface.id)
        setPorts((prev) =>
          prev.filter(
            (p) => p.id !== iface.id && p.parentInterfaceId !== iface.id,
          ),
        )
        if (editRow?.id === iface.id) setEditRow(null)
        notifyPortsChanged()
      } catch (e) {
        setPortsError(e instanceof Error ? e.message : String(e))
      } finally {
        setDeletingPortId(null)
      }
    },
    [editRow?.id, notifyPortsChanged],
  )

  const addPort = useCallback(async () => {
    if (!device?.id) return
    if (newPortKind === 'subif') {
      if (!newParentId) {
        setPortsError('Выберите родительский порт.')
        return
      }
      if (!newVlanId) {
        setPortsError('Выберите VLAN.')
        return
      }
    } else {
      const name = newPortName.trim()
      if (!name) {
        setPortsError('Введите имя порта.')
        return
      }
    }
    const ipTrim = newPortIpv4.trim()
    if (ipTrim && !isValidIpv4Dotted(ipTrim)) {
      setPortsError('Некорректный IPv4-адрес (ожидаются четыре октета 0–255).')
      return
    }
    const maskStr = newPortMask.trim() === '' ? '24' : newPortMask.trim()
    const maskN = parseMaskBits(maskStr, 24)
    if (String(maskN) !== maskStr) {
      setPortsError('Маска (CIDR) должна быть числом от 1 до 32.')
      return
    }
    const combinedL3 = ipTrim ? buildInetCidr(ipTrim, maskStr) : undefined
    setSavingNewPort(true)
    setPortsError(null)
    try {
      const created =
        newPortKind === 'subif'
          ? await createDeviceInterface(device.id, {
              adminStatus: newPortAdmin,
              parentInterfaceId: newParentId,
              dot1qVlanId: Number(newVlanId),
              ipAddress: combinedL3,
            })
          : await createDeviceInterface(device.id, {
              name: newPortName.trim(),
              adminStatus: newPortAdmin,
              ipAddress: combinedL3,
            })
      setPorts((prev) => sortInterfacesForDisplay([...prev, created]))
      setNewPortName('')
      setNewPortAdmin('UP')
      setNewPortKind('physical')
      setNewParentId('')
      setNewVlanId('')
      setNewPortIpv4('')
      setNewPortMask('24')
      notifyPortsChanged()
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNewPort(false)
    }
  }, [
    device?.id,
    newPortName,
    newPortAdmin,
    newPortKind,
    newParentId,
    newVlanId,
    newPortIpv4,
    newPortMask,
    notifyPortsChanged,
  ])

  const portsBusy =
    submitting ||
    savingNewPort ||
    savingEditPort ||
    deletingPortId !== null

  const isRouter = form.deviceType === 'ROUTER'

  const peerByInterfaceId = useMemo(() => {
    if (!linkContext) return null
    const m = new Map<string, string | null>()
    for (const iface of ports) {
      m.set(iface.id, formatPortPeers(iface.id, linkContext))
    }
    return m
  }, [linkContext, ports])

  const ifaceById = useMemo(
    () => new Map(ports.map((i) => [i.id, i])),
    [ports],
  )

  const rootPorts = useMemo(
    () => ports.filter((p) => !p.parentInterfaceId),
    [ports],
  )

  const usedVlanIdsOnParent = useMemo(() => {
    if (!newParentId) return new Set<number>()
    return new Set(
      ports
        .filter(
          (p) => p.parentInterfaceId === newParentId && p.dot1qVlanId != null,
        )
        .map((p) => p.dot1qVlanId as number),
    )
  }, [ports, newParentId])

  const vlansForNewSubif = useMemo(
    () => vlans.filter((v) => !usedVlanIdsOnParent.has(v.vlanId)),
    [vlans, usedVlanIdsOnParent],
  )

  const soleRootPortId = rootPorts.length === 1 ? rootPorts[0].id : null

  useEffect(() => {
    if (!isRouter && newPortKind === 'subif') {
      setNewPortKind('physical')
      setNewParentId('')
      setNewVlanId('')
    }
  }, [isRouter, newPortKind])

  useEffect(() => {
    if (!newVlanId) return
    if (!vlansForNewSubif.some((v) => String(v.vlanId) === newVlanId)) {
      setNewVlanId('')
    }
  }, [newVlanId, vlansForNewSubif])

  useEffect(() => {
    if (!open || mode !== 'edit') return
    if (newPortKind !== 'subif' || soleRootPortId == null) return
    setNewParentId((prev) => prev || soleRootPortId)
  }, [open, mode, newPortKind, soleRootPortId])

  if (!open) return null

  const showPorts = mode === 'edit' && device !== null

  return (
    <div
      className="device-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`device-modal${showPorts ? ' device-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="device-modal__header">
          <h2 className="device-modal__title" id={titleId}>
            {mode === 'create' ? 'Новое устройство' : 'Настройки устройства'}
          </h2>
          <button
            type="button"
            className="device-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <form className="device-modal__form" onSubmit={(e) => void submit(e)}>
          <div className="device-modal__field">
            <label htmlFor="device-type">Тип</label>
            <select
              id="device-type"
              value={form.deviceType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deviceType: e.target.value as DeviceType,
                }))
              }
              disabled={
                submitting || (mode === 'create' && fixedDeviceType != null)
              }
            >
              <option value="SWITCH">Коммутатор</option>
              <option value="ROUTER">Маршрутизатор</option>
            </select>
          </div>

          <div className="device-modal__field">
            <label htmlFor="device-hostname">Имя (hostname)</label>
            <input
              id="device-hostname"
              type="text"
              required
              maxLength={255}
              autoComplete="off"
              value={form.hostname}
              onChange={(e) =>
                setForm((f) => ({ ...f, hostname: e.target.value }))
              }
              disabled={submitting}
            />
          </div>

          <div className="device-modal__field">
            <label htmlFor="device-mgmt-ip">IP управления</label>
            <input
              id="device-mgmt-ip"
              type="text"
              inputMode="decimal"
              required
              maxLength={15}
              placeholder="192.168.0.0"
              autoComplete="off"
              value={form.mgmtIp}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  mgmtIp: formatIpv4WhileTyping(e.target.value),
                }))
              }
              disabled={submitting}
            />
          </div>

          <div className="device-modal__field">
            <label htmlFor="device-status">Статус в модели</label>
            <select
              id="device-status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as NetworkDeviceStatus,
                }))
              }
              disabled={submitting}
            >
              <option value="ACTIVE">Активен</option>
              <option value="INACTIVE">Неактивен</option>
            </select>
          </div>

          {error ? (
              <p className="device-modal__error" role="alert">
                {error}
              </p>
          ) : null}

          <div className="device-modal__actions">
            <button
                type="button"
                className="device-modal__btn device-modal__btn--secondary"
                onClick={onClose}
                disabled={submitting}
            >
              Отмена
            </button>
            <button
                type="submit"
                className="device-modal__btn device-modal__btn--primary"
                disabled={submitting}
            >
              {submitting
                  ? 'Сохранение…'
                  : mode === 'create'
                      ? 'Создать'
                      : 'Сохранить'}
            </button>
          </div>

          {showPorts ? (
            <section
              className="device-modal__section"
              aria-labelledby={portsSectionId}
            >
              <h3 className="device-modal__section-title" id={portsSectionId}>
                Порты и сабинтерфейсы
              </h3>
              {portsLoading ? (
                <p className="device-modal__ports-status">Загрузка списка…</p>
              ) : null}
              {vlansLoading ? (
                <p className="device-modal__ports-status">Загрузка VLAN…</p>
              ) : null}
              {vlansError ? (
                <p className="device-modal__error" role="alert">
                  VLAN: {vlansError}
                </p>
              ) : null}
              {portsError ? (
                <p className="device-modal__error" role="alert">
                  {portsError}
                </p>
              ) : null}
              {!portsLoading && ports.length === 0 ? (
                <p className="device-modal__ports-empty">
                  Портов пока нет — добавьте ниже.
                </p>
              ) : null}
              {ports.length > 0 ? (
                <div className="device-modal__ports-wrap">
                  <table className="device-modal__ports-table">
                    <thead>
                      <tr>
                        <th scope="col">Имя</th>
                        <th scope="col">Родитель</th>
                        <th scope="col">802.1Q</th>
                        <th scope="col">Режим L2</th>
                        <th scope="col">Access / транк</th>
                        <th scope="col">L3</th>
                        <th scope="col">Admin</th>
                        <th scope="col">Соединение</th>
                        <th className="device-modal__ports-actions" scope="col">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((iface) => {
                        const isSub = Boolean(iface.parentInterfaceId)
                        return editRow?.id === iface.id ? (
                          <tr key={iface.id}>
                            <td>
                              <input
                                className="device-modal__ports-input"
                                type="text"
                                value={editRow.name}
                                maxLength={128}
                                onChange={(e) =>
                                  setEditRow((r) =>
                                    r ? { ...r, name: e.target.value } : r,
                                  )
                                }
                                disabled={portsBusy}
                                aria-label="Имя порта"
                              />
                            </td>
                            <td className="device-modal__ports-muted">
                              {parentName(iface, ifaceById)}
                            </td>
                            <td>
                              {isSub ? (
                                <select
                                  className="device-modal__ports-select"
                                  value={editRow.dot1qVlanId}
                                  onChange={(e) =>
                                    setEditRow((r) =>
                                      r
                                        ? { ...r, dot1qVlanId: e.target.value }
                                        : r,
                                    )
                                  }
                                  disabled={portsBusy}
                                  aria-label="VLAN сабинтерфейса"
                                >
                                  <option value="">—</option>
                                  {vlans.map((v) => (
                                    <option
                                      key={v.vlanId}
                                      value={String(v.vlanId)}
                                    >
                                      {v.vlanId}
                                      {v.name ? ` · ${v.name}` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              {!isSub && editRow.l2 ? (
                                <select
                                  className="device-modal__ports-select"
                                  value={editRow.l2.mode}
                                  onChange={(e) => {
                                    const mode = e.target.value as L2EditState['mode']
                                    setEditRow((r) =>
                                      r?.l2
                                        ? {
                                            ...r,
                                            l2: {
                                              ...r.l2,
                                              mode,
                                              accessVlanId:
                                                mode === 'access'
                                                  ? r.l2.accessVlanId
                                                  : '',
                                              nativeVlanId:
                                                mode === 'trunk'
                                                  ? r.l2.nativeVlanId
                                                  : '',
                                              trunkAllowedCsv:
                                                mode === 'trunk'
                                                  ? r.l2.trunkAllowedCsv
                                                  : '',
                                            },
                                          }
                                        : r,
                                    )
                                  }}
                                  disabled={portsBusy}
                                  aria-label="Режим L2"
                                >
                                  <option value="none">Нет</option>
                                  <option value="access">Access</option>
                                  <option value="trunk">Trunk</option>
                                </select>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="device-modal__ports-l2-cell">
                              {!isSub && editRow.l2 ? (
                                editRow.l2.mode === 'none' ? (
                                  <span className="device-modal__ports-muted">
                                    —
                                  </span>
                                ) : editRow.l2.mode === 'access' ? (
                                  <select
                                    className="device-modal__ports-select"
                                    value={editRow.l2.accessVlanId}
                                    onChange={(e) =>
                                      setEditRow((r) =>
                                        r?.l2
                                          ? {
                                              ...r,
                                              l2: {
                                                ...r.l2,
                                                accessVlanId: e.target.value,
                                              },
                                            }
                                          : r,
                                      )
                                    }
                                    disabled={portsBusy || vlans.length === 0}
                                    aria-label="Access VLAN"
                                  >
                                    <option value="">—</option>
                                    {vlans.map((v) => (
                                      <option
                                        key={v.vlanId}
                                        value={String(v.vlanId)}
                                      >
                                        {v.vlanId}
                                        {v.name ? ` · ${v.name}` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="device-modal__ports-l2-trunk">
                                    <select
                                      className="device-modal__ports-select device-modal__ports-select--native"
                                      value={editRow.l2.nativeVlanId}
                                      onChange={(e) =>
                                        setEditRow((r) =>
                                          r?.l2
                                            ? {
                                                ...r,
                                                l2: {
                                                  ...r.l2,
                                                  nativeVlanId: e.target.value,
                                                },
                                              }
                                            : r,
                                        )
                                      }
                                      disabled={portsBusy || vlans.length === 0}
                                      aria-label="Native VLAN"
                                    >
                                      <option value="">Native…</option>
                                      {vlans.map((v) => (
                                        <option
                                          key={v.vlanId}
                                          value={String(v.vlanId)}
                                        >
                                          {v.vlanId}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      className="device-modal__ports-input device-modal__ports-input--trunk-csv"
                                      type="text"
                                      placeholder="Разрешённые: 10, 20, 100"
                                      value={editRow.l2.trunkAllowedCsv}
                                      onChange={(e) =>
                                        setEditRow((r) =>
                                          r?.l2
                                            ? {
                                                ...r,
                                                l2: {
                                                  ...r.l2,
                                                  trunkAllowedCsv:
                                                    e.target.value,
                                                },
                                              }
                                            : r,
                                        )
                                      }
                                      disabled={portsBusy}
                                      aria-label="Разрешённые VLAN (через запятую)"
                                    />
                                  </div>
                                )
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <div className="device-modal__l3-inline">
                                <input
                                  className="device-modal__ports-input device-modal__ports-input--ip"
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="192.168.0.0"
                                  value={editRow.ipv4}
                                  maxLength={15}
                                  autoComplete="off"
                                  onChange={(e) =>
                                    setEditRow((r) =>
                                      r
                                        ? {
                                            ...r,
                                            ipv4: formatIpv4WhileTyping(
                                              e.target.value,
                                            ),
                                          }
                                        : r,
                                    )
                                  }
                                  disabled={portsBusy}
                                  aria-label="IPv4"
                                />
                                <span
                                  className="device-modal__l3-slash"
                                  aria-hidden
                                >
                                  /
                                </span>
                                <input
                                  className="device-modal__ports-input device-modal__ports-input--mask"
                                  type="number"
                                  min={1}
                                  max={32}
                                  step={1}
                                  value={editRow.maskBits}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setEditRow((r) => {
                                      if (!r) return r
                                      if (v === '')
                                        return { ...r, maskBits: '' }
                                      const n = Number(v)
                                      if (!Number.isFinite(n)) return r
                                      return {
                                        ...r,
                                        maskBits: String(
                                          Math.min(
                                            32,
                                            Math.max(1, Math.trunc(n)),
                                          ),
                                        ),
                                      }
                                    })
                                  }}
                                  onBlur={() =>
                                    setEditRow((r) =>
                                      r &&
                                      (r.maskBits.trim() === '' ||
                                        !Number.isFinite(Number(r.maskBits)))
                                        ? { ...r, maskBits: '24' }
                                        : r,
                                    )
                                  }
                                  disabled={portsBusy}
                                  aria-label="Длина маски CIDR"
                                />
                              </div>
                            </td>
                            <td>
                              <select
                                className="device-modal__ports-select"
                                value={editRow.adminStatus}
                                onChange={(e) =>
                                  setEditRow((r) =>
                                    r
                                      ? {
                                          ...r,
                                          adminStatus: e.target
                                            .value as 'UP' | 'DOWN',
                                        }
                                      : r,
                                  )
                                }
                                disabled={portsBusy}
                                aria-label="Статус порта"
                              >
                                <option value="UP">UP</option>
                                <option value="DOWN">DOWN</option>
                              </select>
                            </td>
                            <td className="device-modal__ports-peer">
                              {peerByInterfaceId?.get(iface.id) ?? '—'}
                            </td>
                            <td className="device-modal__ports-actions">
                              <button
                                type="button"
                                className="device-modal__btn-inline device-modal__btn-inline--primary"
                                disabled={portsBusy}
                                onClick={() => void saveEdit()}
                              >
                                {savingEditPort ? '…' : 'Сохранить'}
                              </button>
                              <button
                                type="button"
                                className="device-modal__btn-inline"
                                disabled={portsBusy}
                                onClick={cancelEdit}
                              >
                                Отмена
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={iface.id}>
                            <td
                              className={
                                isSub ? 'device-modal__ports-subif' : undefined
                              }
                            >
                              {isSub ? `↳ ${iface.name}` : iface.name}
                            </td>
                            <td className="device-modal__ports-muted">
                              {parentName(iface, ifaceById)}
                            </td>
                            <td>
                              {iface.dot1qVlanId != null
                                ? iface.dot1qVlanId
                                : '—'}
                            </td>
                            <td>
                              {!isSub && iface.vlanBinding
                                ? iface.vlanBinding.mode
                                : '—'}
                            </td>
                            <td className="device-modal__ports-muted device-modal__ports-l2-cell">
                              {!isSub
                                ? formatPhysicalL2Summary(iface.vlanBinding)
                                : '—'}
                            </td>
                            <td className="device-modal__ports-muted">
                              {iface.ipAddress ?? '—'}
                            </td>
                            <td>{iface.adminStatus}</td>
                            <td className="device-modal__ports-peer">
                              {peerByInterfaceId?.get(iface.id) ?? '—'}
                            </td>
                            <td className="device-modal__ports-actions">
                              <button
                                type="button"
                                className="device-modal__btn-inline"
                                disabled={portsBusy}
                                onClick={() => startEdit(iface)}
                              >
                                Изменить
                              </button>
                              <button
                                type="button"
                                className="device-modal__btn-inline device-modal__btn-inline--danger"
                                disabled={portsBusy}
                                onClick={() => void removePort(iface)}
                              >
                                {deletingPortId === iface.id ? '…' : 'Удалить'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="device-modal__ports-add">
                <span className="device-modal__ports-add-label">
                  Новый интерфейс
                </span>
                <div className="device-modal__ports-kind-row">
                  <label className="device-modal__ports-radio-line">
                    <input
                      type="radio"
                      name="new-port-kind"
                      checked={newPortKind === 'physical'}
                      onChange={() => {
                        setNewPortKind('physical')
                        setNewParentId('')
                        setNewVlanId('')
                      }}
                      disabled={portsBusy}
                    />
                    Физический порт
                  </label>
                  {isRouter ? (
                    <label className="device-modal__ports-radio-line">
                      <input
                        type="radio"
                        name="new-port-kind"
                        checked={newPortKind === 'subif'}
                        onChange={() => setNewPortKind('subif')}
                        disabled={portsBusy}
                      />
                      Сабинтерфейс (802.1Q)
                    </label>
                  ) : null}
                </div>
                <div className="device-modal__ports-new-line">
                  {newPortKind === 'subif' ? (
                    <>
                      <select
                        className="device-modal__new-select"
                        value={newParentId}
                        onChange={(e) => {
                          setNewParentId(e.target.value)
                          setNewVlanId('')
                        }}
                        disabled={portsBusy || rootPorts.length === 0}
                        aria-label="Родительский порт"
                      >
                        <option value="">Родитель…</option>
                        {rootPorts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="device-modal__new-select"
                        value={newVlanId}
                        onChange={(e) => setNewVlanId(e.target.value)}
                        disabled={
                          portsBusy ||
                          !newParentId ||
                          vlansForNewSubif.length === 0
                        }
                        aria-label="VLAN"
                      >
                        <option value="">
                          {!newParentId
                            ? 'VLAN…'
                            : vlansForNewSubif.length === 0
                              ? 'Нет свободных VLAN'
                              : 'VLAN…'}
                        </option>
                        {vlansForNewSubif.map((v) => (
                          <option key={v.vlanId} value={String(v.vlanId)}>
                            {v.vlanId}
                            {v.name ? ` · ${v.name}` : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  {newPortKind === 'physical' ? (
                    <input
                      className="device-modal__new-name"
                      type="text"
                      placeholder="Имя (Gi0/1)"
                      value={newPortName}
                      maxLength={128}
                      autoComplete="off"
                      onChange={(e) => setNewPortName(e.target.value)}
                      disabled={portsBusy}
                      aria-label="Имя нового порта"
                    />
                  ) : null}
                  <div className="device-modal__l3-inline device-modal__l3-inline--new">
                    <input
                      className="device-modal__new-ipv4"
                      type="text"
                      inputMode="decimal"
                      placeholder="192.168.0.0"
                      value={newPortIpv4}
                      maxLength={15}
                      autoComplete="off"
                      onChange={(e) =>
                        setNewPortIpv4(
                          formatIpv4WhileTyping(e.target.value),
                        )
                      }
                      disabled={portsBusy}
                      aria-label="IPv4 (опционально)"
                    />
                    <span className="device-modal__l3-slash" aria-hidden>
                      /
                    </span>
                    <input
                      className="device-modal__new-mask"
                      type="number"
                      min={1}
                      max={32}
                      step={1}
                      value={newPortMask}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '') {
                          setNewPortMask('')
                          return
                        }
                        const n = Number(v)
                        if (!Number.isFinite(n)) return
                        setNewPortMask(
                          String(Math.min(32, Math.max(1, Math.trunc(n)))),
                        )
                      }}
                      onBlur={() => {
                        if (
                          newPortMask.trim() === '' ||
                          !Number.isFinite(Number(newPortMask))
                        ) {
                          setNewPortMask('24')
                        }
                      }}
                      disabled={portsBusy}
                      aria-label="Маска CIDR (1–32)"
                    />
                  </div>
                  <select
                    className="device-modal__new-admin"
                    value={newPortAdmin}
                    onChange={(e) =>
                      setNewPortAdmin(e.target.value as 'UP' | 'DOWN')
                    }
                    disabled={portsBusy}
                    aria-label="Статус нового порта"
                  >
                    <option value="UP">UP</option>
                    <option value="DOWN">DOWN</option>
                  </select>
                  <button
                    type="button"
                    className="device-modal__btn device-modal__btn--secondary device-modal__new-add"
                    disabled={portsBusy}
                    onClick={() => void addPort()}
                  >
                    {savingNewPort ? '…' : 'Добавить'}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </form>
      </div>
    </div>
  )
}
