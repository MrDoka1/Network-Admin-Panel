import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react'
import { createVlan } from '../../api/networkClient'
import type {
  Vlan,
  VlanAdminStatus,
  VlanCreatePayload,
  VlanOperStatus,
} from '../../types/network'
import './DeviceModal.css'

type Props = {
  open: boolean
  onClose: () => void
  /** После успешного POST — например закрыть и обновить списки */
  onCreated?: (vlan: Vlan) => void
}

type Form = {
  vlanId: string
  name: string
  adminStatus: VlanAdminStatus
  operStatus: '' | VlanOperStatus
}

const emptyForm = (): Form => ({
  vlanId: '',
  name: '',
  adminStatus: 'ACTIVE',
  operStatus: '',
})

export function VlanModal({ open, onClose, onCreated }: Props) {
  const titleId = useId()
  const [form, setForm] = useState<Form>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      const raw = form.vlanId.trim()
      const id = Number(raw)
      if (
        raw === '' ||
        !Number.isInteger(id) ||
        id < 1 ||
        id > 4094
      ) {
        setError('Укажите номер VLAN (VID) от 1 до 4094.')
        return
      }
      const payload: VlanCreatePayload = { vlanId: id }
      const name = form.name.trim()
      if (name) payload.name = name
      if (form.adminStatus !== 'ACTIVE') payload.adminStatus = form.adminStatus
      if (form.operStatus !== '') payload.operStatus = form.operStatus

      setSubmitting(true)
      try {
        const created = await createVlan(payload)
        onCreated?.(created)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSubmitting(false)
      }
    },
    [form, onClose, onCreated],
  )

  if (!open) return null

  return (
    <div
      className="device-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="device-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="device-modal__header">
          <h2 className="device-modal__title" id={titleId}>
            Новый VLAN
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
          <p className="link-modal__hint">
            В модели VLAN идентифицируется номером 802.1Q (1–4094). Имя и
            операционный статус необязательны.
          </p>

          <div className="device-modal__field">
            <label htmlFor="vlan-modal-vid">Номер VLAN (VID)</label>
            <input
              id="vlan-modal-vid"
              type="number"
              min={1}
              max={4094}
              step={1}
              required
              inputMode="numeric"
              autoComplete="off"
              value={form.vlanId}
              onChange={(e) =>
                setForm((f) => ({ ...f, vlanId: e.target.value }))
              }
              disabled={submitting}
            />
          </div>

          <div className="device-modal__field">
            <label htmlFor="vlan-modal-name">Имя (опционально)</label>
            <input
              id="vlan-modal-name"
              type="text"
              maxLength={256}
              autoComplete="off"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              disabled={submitting}
            />
          </div>

          <div className="device-modal__field">
            <label htmlFor="vlan-modal-admin">Административный статус</label>
            <select
              id="vlan-modal-admin"
              value={form.adminStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  adminStatus: e.target.value as VlanAdminStatus,
                }))
              }
              disabled={submitting}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <div className="device-modal__field">
            <label htmlFor="vlan-modal-oper">Операционный статус</label>
            <select
              id="vlan-modal-oper"
              value={form.operStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  operStatus:
                    e.target.value === ''
                      ? ''
                      : (e.target.value as VlanOperStatus),
                }))
              }
              disabled={submitting}
            >
              <option value="">Не задан</option>
              <option value="UP">UP</option>
              <option value="DOWN">DOWN</option>
              <option value="UNKNOWN">UNKNOWN</option>
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
              {submitting ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
