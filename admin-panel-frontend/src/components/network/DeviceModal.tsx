import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  createDevice,
  createDeviceInterface,
  deleteDeviceInterface,
  fetchInterfacesForDevice,
  updateDevice,
  updateDeviceInterface,
} from '../../api/networkClient'
import type {
  DeviceInterface,
  DeviceType,
  Link,
  NetworkDevice,
  NetworkDeviceStatus,
} from '../../types/network'
import './DeviceModal.css'

type Mode = 'create' | 'edit'

type FormState = {
  deviceType: DeviceType
  hostname: string
  mgmtIp: string
  status: NetworkDeviceStatus
}

type EditRow = {
  id: string
  name: string
  adminStatus: 'UP' | 'DOWN'
}

const defaultForm = (): FormState => ({
  deviceType: 'SWITCH',
  hostname: '',
  mgmtIp: '',
  status: 'ACTIVE',
})

function formFromDevice(d: NetworkDevice): FormState {
  return {
    deviceType: d.deviceType,
    hostname: d.hostname,
    mgmtIp: d.mgmtIp,
    status: d.status,
  }
}

function sortInterfaces(list: DeviceInterface[]): DeviceInterface[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  )
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
}

export function DeviceModal({
  mode,
  device,
  open,
  onClose,
  onSaved,
  onPortsChanged,
  linkContext,
}: Props) {
  const titleId = useId()
  const portsSectionId = useId()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ports, setPorts] = useState<DeviceInterface[]>([])
  const [portsLoading, setPortsLoading] = useState(false)
  const [portsError, setPortsError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<EditRow | null>(null)
  const [newPortName, setNewPortName] = useState('')
  const [newPortAdmin, setNewPortAdmin] = useState<'UP' | 'DOWN'>('UP')
  const [savingNewPort, setSavingNewPort] = useState(false)
  const [savingEditPort, setSavingEditPort] = useState(false)
  const [deletingPortId, setDeletingPortId] = useState<string | null>(null)

  const loadPorts = useCallback(async () => {
    if (!device?.id || mode !== 'edit') return
    setPortsLoading(true)
    setPortsError(null)
    try {
      const list = await fetchInterfacesForDevice(device.id)
      setPorts(sortInterfaces(list))
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
      setPorts([])
    } finally {
      setPortsLoading(false)
    }
  }, [device?.id, mode])

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && device) {
      setForm(formFromDevice(device))
    } else {
      setForm(defaultForm())
    }
  }, [open, mode, device])

  useEffect(() => {
    if (!open || mode !== 'edit' || !device) {
      setPorts([])
      setEditRow(null)
      setPortsError(null)
      setNewPortName('')
      setNewPortAdmin('UP')
      return
    }
    void loadPorts()
  }, [open, mode, device, loadPorts])

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
      setSubmitting(true)
      try {
        if (mode === 'create') {
          const created = await createDevice({
            deviceType: form.deviceType,
            hostname: form.hostname.trim(),
            mgmtIp: form.mgmtIp.trim(),
            status: form.status,
          })
          onSaved(created)
        } else {
          if (!device) return
          const updated = await updateDevice(device.id, {
            deviceType: form.deviceType,
            hostname: form.hostname.trim(),
            mgmtIp: form.mgmtIp.trim(),
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
    setEditRow({
      id: iface.id,
      name: iface.name,
      adminStatus: iface.adminStatus,
    })
  }, [])

  const cancelEdit = useCallback(() => setEditRow(null), [])

  const saveEdit = useCallback(async () => {
    if (!editRow) return
    const name = editRow.name.trim()
    if (!name) return
    setSavingEditPort(true)
    setPortsError(null)
    try {
      const updated = await updateDeviceInterface(editRow.id, {
        name,
        adminStatus: editRow.adminStatus,
      })
      setPorts((prev) =>
        sortInterfaces(prev.map((p) => (p.id === updated.id ? updated : p))),
      )
      setEditRow(null)
      notifyPortsChanged()
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingEditPort(false)
    }
  }, [editRow, notifyPortsChanged])

  const removePort = useCallback(
    async (iface: DeviceInterface) => {
      if (
        !window.confirm(
          `Удалить порт «${iface.name}»? Связанные с ним линки в модели будут удалены.`,
        )
      ) {
        return
      }
      setDeletingPortId(iface.id)
      setPortsError(null)
      try {
        await deleteDeviceInterface(iface.id)
        setPorts((prev) => prev.filter((p) => p.id !== iface.id))
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
    const name = newPortName.trim()
    if (!name) {
      setPortsError('Введите имя порта.')
      return
    }
    setSavingNewPort(true)
    setPortsError(null)
    try {
      const created = await createDeviceInterface(device.id, {
        name,
        adminStatus: newPortAdmin,
      })
      setPorts((prev) => sortInterfaces([...prev, created]))
      setNewPortName('')
      setNewPortAdmin('UP')
      notifyPortsChanged()
    } catch (e) {
      setPortsError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNewPort(false)
    }
  }, [device?.id, newPortName, newPortAdmin, notifyPortsChanged])

  const portsBusy =
    submitting || savingNewPort || savingEditPort || deletingPortId !== null

  const peerByInterfaceId = useMemo(() => {
    if (!linkContext) return null
    const m = new Map<string, string | null>()
    for (const iface of ports) {
      m.set(iface.id, formatPortPeers(iface.id, linkContext))
    }
    return m
  }, [linkContext, ports])

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
              disabled={submitting}
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
              required
              maxLength={64}
              autoComplete="off"
              value={form.mgmtIp}
              onChange={(e) => setForm((f) => ({ ...f, mgmtIp: e.target.value }))}
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

          {showPorts ? (
            <section
              className="device-modal__section"
              aria-labelledby={portsSectionId}
            >
              <h3 className="device-modal__section-title" id={portsSectionId}>
                Порты
              </h3>
              {portsLoading ? (
                <p className="device-modal__ports-status">Загрузка списка…</p>
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
                        <th scope="col">Статус</th>
                        <th scope="col">Соединение</th>
                        <th className="device-modal__ports-actions" scope="col">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((iface) =>
                        editRow?.id === iface.id ? (
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
                            <td>{iface.name}</td>
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
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="device-modal__ports-add">
                <span className="device-modal__ports-add-label">
                  Новый порт
                </span>
                <div className="device-modal__ports-add-row">
                  <input
                    type="text"
                    placeholder="Имя (например Gi0/1)"
                    value={newPortName}
                    maxLength={128}
                    autoComplete="off"
                    onChange={(e) => setNewPortName(e.target.value)}
                    disabled={portsBusy}
                    aria-label="Имя нового порта"
                  />
                  <select
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
                    className="device-modal__btn device-modal__btn--secondary"
                    disabled={portsBusy}
                    onClick={() => void addPort()}
                  >
                    {savingNewPort ? 'Добавление…' : 'Добавить'}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

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
        </form>
      </div>
    </div>
  )
}
