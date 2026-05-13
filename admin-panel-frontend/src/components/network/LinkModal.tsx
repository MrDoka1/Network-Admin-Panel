import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { createDeviceInterface, createLink } from '../../api/networkClient'
import type { DeviceInterface, Link, NetworkDevice } from '../../types/network'
import './DeviceModal.css'

type Props = {
  deviceA: NetworkDevice
  deviceB: NetworkDevice
  interfacesA: DeviceInterface[]
  interfacesB: DeviceInterface[]
  /** Интерфейсы, уже участвующие в каком-либо линке */
  busyInterfaceIds: ReadonlySet<string>
  /** Подставить из точки соединения на графе (свободные порты) */
  presetInterfaceAId?: string
  presetInterfaceBId?: string
  open: boolean
  /** После создания порта — обновить топологию (например load()) */
  onTopologyChanged: () => void
  onClose: () => void
  onCreated: (link: Link) => void
}

function sortByName(a: DeviceInterface, b: DeviceInterface): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true })
}

function InterfaceQuickAdd({
  deviceId,
  disabled,
  onCreated,
}: {
  deviceId: string
  disabled: boolean
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [adminStatus, setAdminStatus] = useState<'UP' | 'DOWN'>('UP')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = useCallback(async () => {
    const n = name.trim()
    if (!n) {
      setError('Введите имя порта.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await createDeviceInterface(deviceId, {
        name: n,
        adminStatus,
      })
      setName('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [deviceId, name, adminStatus, onCreated])

  return (
    <div className="link-modal__quick">
      <div className="link-modal__quick-row">
        <input
          type="text"
          placeholder="Имя порта (например Gi0/1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled || saving}
          maxLength={128}
          autoComplete="off"
          aria-label="Имя нового порта"
        />
        <select
          value={adminStatus}
          onChange={(e) =>
            setAdminStatus(e.target.value as 'UP' | 'DOWN')
          }
          disabled={disabled || saving}
          aria-label="Состояние порта"
        >
          <option value="UP">UP</option>
          <option value="DOWN">DOWN</option>
        </select>
        <button
          type="button"
          className="device-modal__btn device-modal__btn--secondary"
          disabled={disabled || saving}
          onClick={() => void add()}
        >
          {saving ? '…' : 'Добавить порт'}
        </button>
      </div>
      {error ? (
        <p className="device-modal__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function LinkModal({
  deviceA,
  deviceB,
  interfacesA,
  interfacesB,
  busyInterfaceIds,
  presetInterfaceAId,
  presetInterfaceBId,
  open,
  onTopologyChanged,
  onClose,
  onCreated,
}: Props) {
  const titleId = useId()
  const idSelectA = useId()
  const idSelectB = useId()
  const [interfaceAId, setInterfaceAId] = useState('')
  const [interfaceBId, setInterfaceBId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const freeA = useMemo(
    () =>
      interfacesA
        .filter((i) => !i.parentInterfaceId)
        .filter((i) => !busyInterfaceIds.has(i.id))
        .sort(sortByName),
    [interfacesA, busyInterfaceIds],
  )
  const freeB = useMemo(
    () =>
      interfacesB
        .filter((i) => !i.parentInterfaceId)
        .filter((i) => !busyInterfaceIds.has(i.id))
        .sort(sortByName),
    [interfacesB, busyInterfaceIds],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    const pickA =
      presetInterfaceAId &&
      freeA.some((i) => i.id === presetInterfaceAId)
        ? presetInterfaceAId
        : freeA[0]?.id ?? ''
    const pickB =
      presetInterfaceBId &&
      freeB.some((i) => i.id === presetInterfaceBId)
        ? presetInterfaceBId
        : freeB[0]?.id ?? ''
    setInterfaceAId(pickA)
    setInterfaceBId(pickB)
  }, [
    open,
    deviceA.id,
    deviceB.id,
    freeA,
    freeB,
    presetInterfaceAId,
    presetInterfaceBId,
  ])

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
      if (!interfaceAId || !interfaceBId) {
        setError('Выберите порт на каждом устройстве или добавьте порты ниже.')
        return
      }
      if (interfaceAId === interfaceBId) {
        setError('Нельзя соединить интерфейс с самим собой.')
        return
      }
      setSubmitting(true)
      try {
        const link = await createLink({
          interfaceAId,
          interfaceBId,
        })
        onCreated(link)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSubmitting(false)
      }
    },
    [interfaceAId, interfaceBId, onCreated],
  )

  if (!open) return null

  const canSubmit = freeA.length > 0 && freeB.length > 0

  const hintA =
    freeA.length > 0
      ? null
      : interfacesA.length === 0
        ? 'У устройства ещё нет портов в модели — сначала добавьте хотя бы один порт ниже.'
        : 'Все текущие порты уже участвуют в линках — добавьте новый порт ниже или удалите лишний линк.'

  const hintB =
    freeB.length > 0
      ? null
      : interfacesB.length === 0
        ? 'У устройства ещё нет портов в модели — сначала добавьте хотя бы один порт ниже.'
        : 'Все текущие порты уже участвуют в линках — добавьте новый порт ниже или удалите лишний линк.'

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
            Новый линк
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
          <p className="link-modal__intro">
            <span className="link-modal__host">{deviceA.hostname}</span>
            <span className="link-modal__arrow" aria-hidden>
              {' '}
              ↔{' '}
            </span>
            <span className="link-modal__host">{deviceB.hostname}</span>
          </p>

          <div className="device-modal__field">
            <label htmlFor={idSelectA}>Порт на {deviceA.hostname}</label>
            {hintA ? (
              <p className="link-modal__hint" id={`${idSelectA}-hint`}>
                {hintA}
              </p>
            ) : null}
            <select
              id={idSelectA}
              value={interfaceAId}
              onChange={(e) => setInterfaceAId(e.target.value)}
              disabled={submitting || freeA.length === 0}
              required={freeA.length > 0}
              aria-describedby={hintA ? `${idSelectA}-hint` : undefined}
            >
              {freeA.length === 0 ? (
                <option value="">— выберите после добавления порта —</option>
              ) : (
                freeA.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.adminStatus})
                  </option>
                ))
              )}
            </select>
            {freeA.length === 0 ? (
              <InterfaceQuickAdd
                deviceId={deviceA.id}
                disabled={submitting}
                onCreated={onTopologyChanged}
              />
            ) : null}
          </div>

          <div className="device-modal__field">
            <label htmlFor={idSelectB}>Порт на {deviceB.hostname}</label>
            {hintB ? (
              <p className="link-modal__hint" id={`${idSelectB}-hint`}>
                {hintB}
              </p>
            ) : null}
            <select
              id={idSelectB}
              value={interfaceBId}
              onChange={(e) => setInterfaceBId(e.target.value)}
              disabled={submitting || freeB.length === 0}
              required={freeB.length > 0}
              aria-describedby={hintB ? `${idSelectB}-hint` : undefined}
            >
              {freeB.length === 0 ? (
                <option value="">— выберите после добавления порта —</option>
              ) : (
                freeB.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.adminStatus})
                  </option>
                ))
              )}
            </select>
            {freeB.length === 0 ? (
              <InterfaceQuickAdd
                deviceId={deviceB.id}
                disabled={submitting}
                onCreated={onTopologyChanged}
              />
            ) : null}
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
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Создание…' : 'Создать линк'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
