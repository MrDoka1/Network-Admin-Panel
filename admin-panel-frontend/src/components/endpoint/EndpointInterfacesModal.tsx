import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import type { EndpointDevice, EndpointDeviceInterface } from '../../types/endpoint'
import '../network/DeviceModal.css'

type EditRow = {
  id: string
  name: string
  macAddress: string
  adminStatus: 'UP' | 'DOWN'
}

type Props = {
  device: EndpointDevice
  interfaces: EndpointDeviceInterface[]
  open: boolean
  onClose: () => void
  onChanged: () => void
  onCreate: (payload: {
    name: string
    macAddress: string
    adminStatus: 'UP' | 'DOWN'
  }) => Promise<void>
  onUpdate: (
    id: string,
    payload: { name: string; macAddress: string; adminStatus: 'UP' | 'DOWN' },
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EndpointInterfacesModal({
  device,
  interfaces,
  open,
  onClose,
  onChanged,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const titleId = useId()
  const [newName, setNewName] = useState('')
  const [newMac, setNewMac] = useState('')
  const [newAdmin, setNewAdmin] = useState<'UP' | 'DOWN'>('UP')
  const [savingNew, setSavingNew] = useState(false)
  const [editRow, setEditRow] = useState<EditRow | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...interfaces].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewName('')
    setNewMac('')
    setNewAdmin('UP')
    setEditRow(null)
  }, [open, device.id])

  const startEdit = useCallback((i: EndpointDeviceInterface) => {
    setEditRow({
      id: i.id,
      name: i.name,
      macAddress: i.macAddress,
      adminStatus: i.adminStatus,
    })
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSavingNew(true)
    setError(null)
    try {
      await onCreate({
        name: newName.trim(),
        macAddress: newMac.trim(),
        adminStatus: newAdmin,
      })
      setNewName('')
      setNewMac('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingNew(false)
    }
  }

  async function saveEdit() {
    if (!editRow) return
    setSavingEdit(true)
    setError(null)
    try {
      await onUpdate(editRow.id, {
        name: editRow.name.trim(),
        macAddress: editRow.macAddress.trim(),
        adminStatus: editRow.adminStatus,
      })
      setEditRow(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить этот интерфейс?')) return
    setDeletingId(id)
    setError(null)
    try {
      await onDelete(id)
      if (editRow?.id === id) setEditRow(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingId(null)
    }
  }

  if (!open) return null

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
            Интерфейсы: {device.hostname}
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
        <div className="device-modal__form">
          {error ? <p className="device-modal__error">{error}</p> : null}

          <div className="device-modal__section">
            <h3 className="device-modal__section-title">Список NIC</h3>
            <div className="device-modal__ports-wrap">
              <table className="device-modal__ports-table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>MAC</th>
                    <th>Admin</th>
                    <th>Порт сети</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((i) =>
                    editRow?.id === i.id ? (
                      <tr key={i.id}>
                        <td>
                          <input
                            className="device-modal__ports-input"
                            value={editRow.name}
                            onChange={(e) =>
                              setEditRow({ ...editRow, name: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="device-modal__ports-input"
                            value={editRow.macAddress}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                macAddress: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="device-modal__ports-select"
                            value={editRow.adminStatus}
                            onChange={(e) =>
                              setEditRow({
                                ...editRow,
                                adminStatus: e.target.value as 'UP' | 'DOWN',
                              })
                            }
                          >
                            <option value="UP">UP</option>
                            <option value="DOWN">DOWN</option>
                          </select>
                        </td>
                        <td>
                          <span className="device-modal__ports-peer">
                            {i.networkInterfaceId ?? '—'}
                          </span>
                        </td>
                        <td className="device-modal__ports-actions">
                          <button
                            type="button"
                            className="device-modal__btn-inline device-modal__btn-inline--primary"
                            onClick={() => void saveEdit()}
                            disabled={savingEdit}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            className="device-modal__btn-inline"
                            onClick={() => setEditRow(null)}
                            disabled={savingEdit}
                          >
                            Отмена
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={i.id}>
                        <td>{i.name}</td>
                        <td>
                          <code>{i.macAddress}</code>
                        </td>
                        <td>{i.adminStatus}</td>
                        <td>
                          <span className="device-modal__ports-peer">
                            {i.networkInterfaceId ?? '—'}
                          </span>
                        </td>
                        <td className="device-modal__ports-actions">
                          <button
                            type="button"
                            className="device-modal__btn-inline"
                            onClick={() => startEdit(i)}
                            disabled={!!editRow || savingEdit || deletingId === i.id}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="device-modal__btn-inline device-modal__btn-inline--danger"
                            onClick={() => void handleDelete(i.id)}
                            disabled={
                              !!editRow ||
                              savingEdit ||
                              deletingId === i.id ||
                              !!i.networkInterfaceId
                            }
                            title={
                              i.networkInterfaceId
                                ? 'Сначала удалите подключение'
                                : undefined
                            }
                          >
                            {deletingId === i.id ? '…' : 'Удалить'}
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <form className="device-modal__ports-add" onSubmit={handleAdd}>
              <span className="device-modal__ports-add-label">
                Добавить интерфейс
              </span>
              <div className="device-modal__ports-add-row">
                <input
                  placeholder="Имя (eth0)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={128}
                />
                <input
                  placeholder="MAC"
                  value={newMac}
                  onChange={(e) => setNewMac(e.target.value)}
                  required
                  maxLength={32}
                />
                <select
                  value={newAdmin}
                  onChange={(e) =>
                    setNewAdmin(e.target.value as 'UP' | 'DOWN')
                  }
                >
                  <option value="UP">UP</option>
                  <option value="DOWN">DOWN</option>
                </select>
                <button
                  type="submit"
                  className="device-modal__btn device-modal__btn--primary"
                  disabled={savingNew}
                >
                  {savingNew ? '…' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>

          <div className="device-modal__actions">
            <button
              type="button"
              className="device-modal__btn device-modal__btn--secondary"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
