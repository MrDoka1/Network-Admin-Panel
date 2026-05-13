import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import type {
  EndpointDevice,
  EndpointDeviceInterface,
  EndpointNetworkAttachment,
} from '../../types/endpoint'
import type { DeviceInterface, Link, NetworkDevice } from '../../types/network'
import '../network/DeviceModal.css'

function labelNetworkInterface(
  ifaceId: string,
  networkDevices: NetworkDevice[],
  networkInterfaces: DeviceInterface[],
): string {
  const i = networkInterfaces.find((x) => x.id === ifaceId)
  if (!i) return ifaceId
  const d = networkDevices.find((x) => x.id === i.deviceId)
  return d ? `${d.hostname} — ${i.name}` : i.name
}

function labelEndpointInterface(
  iface: EndpointDeviceInterface,
  endpointHostnames: Map<string, string>,
): string {
  const h = endpointHostnames.get(iface.endpointDeviceId) ?? '?'
  return `${h} — ${iface.name} (${iface.macAddress})`
}

type Props = {
  mode: 'create' | 'edit'
  attachment: EndpointNetworkAttachment | null
  open: boolean
  endpointDevices: EndpointDevice[]
  networkDevices: NetworkDevice[]
  networkInterfaces: DeviceInterface[]
  endpointInterfaces: EndpointDeviceInterface[]
  attachments: EndpointNetworkAttachment[]
  links: Link[]
  onClose: () => void
  onSaved: () => void
  onSubmit: (payload: {
    networkInterfaceId: string
    endpointInterfaceId: string
  }) => Promise<void>
}

export function EndpointAttachmentModal({
  mode,
  attachment,
  open,
  endpointDevices,
  networkDevices,
  networkInterfaces,
  endpointInterfaces,
  attachments,
  links,
  onClose,
  onSaved,
  onSubmit,
}: Props) {
  const titleId = useId()
  const [netIf, setNetIf] = useState('')
  const [epIf, setEpIf] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endpointHostnameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of endpointDevices) {
      m.set(d.id, d.hostname)
    }
    return m
  }, [endpointDevices])

  const usedInLinks = useMemo(() => {
    const s = new Set<string>()
    for (const l of links) {
      s.add(l.interfaceAId)
      s.add(l.interfaceBId)
    }
    return s
  }, [links])

  const takenNetworkIds = useMemo(
    () =>
      new Set(
        attachments
          .filter(
            (a) => mode !== 'edit' || !attachment || a.id !== attachment.id,
          )
          .map((a) => a.networkInterfaceId),
      ),
    [attachments, attachment, mode],
  )

  const takenEndpointIds = useMemo(
    () =>
      new Set(
        attachments
          .filter(
            (a) => mode !== 'edit' || !attachment || a.id !== attachment.id,
          )
          .map((a) => a.endpointInterfaceId),
      ),
    [attachments, attachment, mode],
  )

  const networkOptions = useMemo(() => {
    return networkInterfaces
      .filter((i) => !usedInLinks.has(i.id))
      .filter(
        (i) =>
          !takenNetworkIds.has(i.id) ||
          i.id === attachment?.networkInterfaceId,
      )
      .sort((a, b) => {
        const da =
          networkDevices.find((d) => d.id === a.deviceId)?.hostname ?? ''
        const db =
          networkDevices.find((d) => d.id === b.deviceId)?.hostname ?? ''
        const c = da.localeCompare(db)
        return c !== 0 ? c : a.name.localeCompare(b.name, undefined, { numeric: true })
      })
  }, [
    networkInterfaces,
    networkDevices,
    usedInLinks,
    takenNetworkIds,
    attachment,
  ])

  const endpointOptions = useMemo(() => {
    return endpointInterfaces
      .filter(
        (i) =>
          !takenEndpointIds.has(i.id) ||
          i.id === attachment?.endpointInterfaceId,
      )
      .sort((a, b) => {
        const ha = endpointHostnameById.get(a.endpointDeviceId) ?? ''
        const hb = endpointHostnameById.get(b.endpointDeviceId) ?? ''
        const c = ha.localeCompare(hb)
        return c !== 0 ? c : a.name.localeCompare(b.name, undefined, { numeric: true })
      })
  }, [endpointInterfaces, endpointHostnameById, takenEndpointIds, attachment])

  const firstNetId = networkOptions[0]?.id ?? ''
  const firstEpId = endpointOptions[0]?.id ?? ''

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && attachment) {
      setNetIf(attachment.networkInterfaceId)
      setEpIf(attachment.endpointInterfaceId)
    } else {
      setNetIf(firstNetId)
      setEpIf(firstEpId)
    }
  }, [
    open,
    mode,
    attachment?.id,
    attachment?.networkInterfaceId,
    attachment?.endpointInterfaceId,
    firstNetId,
    firstEpId,
  ])

  if (!open) return null

  const title =
    mode === 'create' ? 'Новое подключение' : 'Изменить подключение'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!netIf || !epIf) {
      setError('Выберите порт сети и интерфейс оконечного устройства')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ networkInterfaceId: netIf, endpointInterfaceId: epIf })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="device-modal-backdrop"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="device-modal device-modal--wide"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="device-modal__header">
          <h2 className="device-modal__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="device-modal__close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form className="device-modal__form" onSubmit={handleSubmit}>
          <p className="link-modal__hint">
            Порт инфраструктуры не должен участвовать в линке между коммутаторами.
            Свободные порты и NIC без другого подключения показаны в списках.
          </p>
          <div className="device-modal__field">
            <label htmlFor="ep-att-net">Порт сетевого устройства</label>
            <select
              id="ep-att-net"
              value={netIf}
              onChange={(e) => setNetIf(e.target.value)}
              required
            >
              {networkOptions.length === 0 ? (
                <option value="">Нет доступных портов</option>
              ) : null}
              {networkOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {labelNetworkInterface(i.id, networkDevices, networkInterfaces)}
                </option>
              ))}
            </select>
          </div>
          <div className="device-modal__field">
            <label htmlFor="ep-att-ep">Интерфейс оконечного устройства</label>
            <select
              id="ep-att-ep"
              value={epIf}
              onChange={(e) => setEpIf(e.target.value)}
              required
            >
              {endpointOptions.length === 0 ? (
                <option value="">Нет доступных NIC</option>
              ) : null}
              {endpointOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {labelEndpointInterface(i, endpointHostnameById)}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="device-modal__error">{error}</p> : null}
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
              disabled={
                submitting || !netIf || !epIf || networkOptions.length === 0
              }
            >
              {submitting ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
