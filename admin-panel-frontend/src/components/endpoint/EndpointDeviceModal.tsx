import { useEffect, useId, useState, type FormEvent } from 'react'
import type { EndpointDevice } from '../../types/endpoint'
import type { NetworkDeviceStatus } from '../../types/network'
import '../network/DeviceModal.css'

type Mode = 'create' | 'edit'

type Props = {
  mode: Mode
  device: EndpointDevice | null
  open: boolean
  onClose: () => void
  onSaved: (device: EndpointDevice) => void
  onSubmit: (values: {
    hostname: string
    status: NetworkDeviceStatus
  }) => Promise<EndpointDevice>
}

export function EndpointDeviceModal({
  mode,
  device,
  open,
  onClose,
  onSaved,
  onSubmit,
}: Props) {
  const titleId = useId()
  const [hostname, setHostname] = useState('')
  const [status, setStatus] = useState<NetworkDeviceStatus>('ACTIVE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && device) {
      setHostname(device.hostname)
      setStatus(device.status)
    } else {
      setHostname('')
      setStatus('ACTIVE')
    }
  }, [open, mode, device])

  if (!open) return null

  const title =
    mode === 'create'
      ? 'Новое оконечное устройство'
      : 'Редактировать оконечное устройство'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const saved = await onSubmit({ hostname: hostname.trim(), status })
      onSaved(saved)
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
        className="device-modal"
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
          <div className="device-modal__field">
            <label htmlFor="ep-hostname">Имя (hostname)</label>
            <input
              id="ep-hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
              maxLength={255}
              autoComplete="off"
            />
          </div>
          <div className="device-modal__field">
            <label htmlFor="ep-status">Статус</label>
            <select
              id="ep-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as NetworkDeviceStatus)
              }
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
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
              disabled={submitting}
            >
              {submitting ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
