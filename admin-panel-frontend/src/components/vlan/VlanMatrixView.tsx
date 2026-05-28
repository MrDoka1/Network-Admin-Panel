import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  createDeviceVlan,
  deleteDeviceVlan,
  fetchDeviceVlans,
  fetchDevices,
  fetchVlans,
  createVlan,
  updateVlan,
} from '../../api/networkClient'
import type { DeviceVlan, NetworkDevice, Vlan } from '../../types/network'
import { VlanMatrixCell, type VlanMatrixPending } from './VlanMatrixCell'
import './VlanMatrixView.css'

const PENDING_TIMEOUT_MS = 3000

function sortVlans(vlans: Vlan[]): Vlan[] {
  return [...vlans].sort((a, b) => a.vlanId - b.vlanId)
}

function sortDevices(devices: NetworkDevice[]): NetworkDevice[] {
  return [...devices].sort((a, b) =>
    a.hostname.localeCompare(b.hostname, undefined, { sensitivity: 'base' }),
  )
}

function presenceKey(deviceId: string, vlanId: number): string {
  return `${deviceId}:${vlanId}`
}

export const VlanMatrixView = memo(function VlanMatrixView() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [deviceVlans, setDeviceVlans] = useState<DeviceVlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newVlanId, setNewVlanId] = useState('')
  const [newVlanName, setNewVlanName] = useState('')
  const [newVlanProtected, setNewVlanProtected] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [pending, setPending] = useState<VlanMatrixPending | null>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const [protectTogglingId, setProtectTogglingId] = useState<number | null>(null)
  const [protectError, setProtectError] = useState<string | null>(null)

  const [editingVlanId, setEditingVlanId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [nameSaveBusy, setNameSaveBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current != null) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }, [])

  const clearPending = useCallback(() => {
    clearPendingTimer()
    setPending(null)
  }, [clearPendingTimer])

  const schedulePendingReset = useCallback(() => {
    clearPendingTimer()
    pendingTimerRef.current = setTimeout(() => {
      setPending(null)
      pendingTimerRef.current = null
    }, PENDING_TIMEOUT_MS)
  }, [clearPendingTimer])

  useEffect(() => () => clearPendingTimer(), [clearPendingTimer])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, v, dv] = await Promise.all([
        fetchDevices(),
        fetchVlans(),
        fetchDeviceVlans(),
      ])
      setDevices(d)
      setVlans(sortVlans(v))
      setDeviceVlans(dv)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDevices([])
      setVlans([])
      setDeviceVlans([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedVlans = useMemo(() => sortVlans(vlans), [vlans])
  const sortedDevices = useMemo(() => sortDevices(devices), [devices])

  const presence = useMemo(() => {
    const set = new Set<string>()
    for (const row of deviceVlans) {
      set.add(presenceKey(row.deviceId, row.vlanId))
    }
    return set
  }, [deviceVlans])

  const confirmToggle = useCallback(
    async (deviceId: string, vlanId: number, willAdd: boolean) => {
      setToggling(true)
      setToggleError(null)
      try {
        if (willAdd) {
          const created = await createDeviceVlan(deviceId, vlanId)
          setDeviceVlans((prev) => {
            const key = presenceKey(deviceId, vlanId)
            if (prev.some((r) => presenceKey(r.deviceId, r.vlanId) === key)) {
              return prev
            }
            return [...prev, created]
          })
        } else {
          await deleteDeviceVlan(deviceId, vlanId)
          setDeviceVlans((prev) =>
            prev.filter(
              (r) => !(r.deviceId === deviceId && r.vlanId === vlanId),
            ),
          )
        }
      } catch (e) {
        setToggleError(e instanceof Error ? e.message : String(e))
      } finally {
        setToggling(false)
        clearPending()
      }
    },
    [clearPending],
  )

  const handleCellActivate = useCallback(
    (deviceId: string, vlanId: number, present: boolean) => {
      if (toggling) return

      const isSamePending =
        pending?.deviceId === deviceId && pending?.vlanId === vlanId

      if (isSamePending) {
        clearPendingTimer()
        void confirmToggle(deviceId, vlanId, pending.willAdd)
        return
      }

      setToggleError(null)
      const next: VlanMatrixPending = { deviceId, vlanId, willAdd: !present }
      setPending(next)
      schedulePendingReset()
    },
    [toggling, pending, clearPendingTimer, confirmToggle, schedulePendingReset],
  )

  const submitCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setCreateError(null)
      const raw = newVlanId.trim()
      const id = Number(raw)
      if (raw === '' || !Number.isInteger(id) || id < 1 || id > 4094) {
        setCreateError('Укажите номер VLAN (VID) от 1 до 4094.')
        return
      }
      setCreateBusy(true)
      try {
        const created = await createVlan({
          vlanId: id,
          ...(newVlanName.trim() ? { name: newVlanName.trim() } : {}),
          isProtected: newVlanProtected,
        })
        setVlans((prev) => sortVlans([...prev, created]))
        setNewVlanId('')
        setNewVlanName('')
        setNewVlanProtected(false)
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : String(err))
      } finally {
        setCreateBusy(false)
      }
    },
    [newVlanId, newVlanName, newVlanProtected],
  )

  const toggleVlanProtected = useCallback(async (vlan: Vlan) => {
    if (protectTogglingId != null || editingVlanId != null) return
    setProtectError(null)
    setProtectTogglingId(vlan.vlanId)
    try {
      const updated = await updateVlan(vlan.vlanId, {
        isProtected: !vlan.isProtected,
      })
      setVlans((prev) =>
        sortVlans(
          prev.map((v) => (v.vlanId === updated.vlanId ? updated : v)),
        ),
      )
    } catch (err) {
      setProtectError(err instanceof Error ? err.message : String(err))
    } finally {
      setProtectTogglingId(null)
    }
  }, [protectTogglingId, editingVlanId])

  const startEditVlanName = useCallback((vlan: Vlan) => {
    if (nameSaveBusy || protectTogglingId != null) return
    setNameError(null)
    setEditingVlanId(vlan.vlanId)
    setEditingName(vlan.name ?? '')
  }, [nameSaveBusy, protectTogglingId])

  const cancelEditVlanName = useCallback(() => {
    if (nameSaveBusy) return
    setEditingVlanId(null)
    setEditingName('')
    setNameError(null)
  }, [nameSaveBusy])

  const submitVlanName = useCallback(
    async (e: FormEvent, vlanId: number) => {
      e.preventDefault()
      if (nameSaveBusy) return
      setNameError(null)
      setNameSaveBusy(true)
      try {
        const updated = await updateVlan(vlanId, {
          name: editingName.trim(),
        })
        setVlans((prev) =>
          sortVlans(
            prev.map((v) => (v.vlanId === updated.vlanId ? updated : v)),
          ),
        )
        setEditingVlanId(null)
        setEditingName('')
      } catch (err) {
        setNameError(err instanceof Error ? err.message : String(err))
      } finally {
        setNameSaveBusy(false)
      }
    },
    [editingName, nameSaveBusy],
  )

  return (
    <div className="vlan-matrix">
      <header className="vlan-matrix__header">
        <div className="vlan-matrix__header-top">
          <h1>VLAN</h1>
          <form className="vlan-matrix__create" onSubmit={(e) => void submitCreate(e)}>
            <div className="vlan-matrix__field">
              <label htmlFor="vlan-matrix-vid">VID</label>
              <input
                id="vlan-matrix-vid"
                type="number"
                min={1}
                max={4094}
                step={1}
                inputMode="numeric"
                value={newVlanId}
                onChange={(e) => setNewVlanId(e.target.value)}
                disabled={createBusy}
                placeholder="1–4094"
              />
            </div>
            <div className="vlan-matrix__field">
              <label htmlFor="vlan-matrix-name">Имя</label>
              <input
                id="vlan-matrix-name"
                type="text"
                maxLength={256}
                value={newVlanName}
                onChange={(e) => setNewVlanName(e.target.value)}
                disabled={createBusy}
                placeholder="опционально"
              />
            </div>
            <div className="vlan-matrix__field vlan-matrix__field--checkbox">
              <label htmlFor="vlan-matrix-protected">
                <input
                  id="vlan-matrix-protected"
                  type="checkbox"
                  checked={newVlanProtected}
                  onChange={(e) => setNewVlanProtected(e.target.checked)}
                  disabled={createBusy}
                />
                Защищённый
              </label>
            </div>
            <button
              type="submit"
              className="vlan-matrix__btn vlan-matrix__btn--primary"
              disabled={createBusy}
            >
              {createBusy ? '…' : 'Создать'}
            </button>
            {createError ? (
              <p className="vlan-matrix__create-error" role="alert">
                {createError}
              </p>
            ) : null}
          </form>
        </div>
        {toggleError ? (
          <p className="vlan-matrix__error" role="alert">
            {toggleError}
          </p>
        ) : null}
        {protectError ? (
          <p className="vlan-matrix__error" role="alert">
            {protectError}
          </p>
        ) : null}
        {nameError ? (
          <p className="vlan-matrix__error" role="alert">
            {nameError}
          </p>
        ) : null}
      </header>

      {loading ? (
        <p className="vlan-matrix__loading">Загрузка…</p>
      ) : error ? (
        <p className="vlan-matrix__error" role="alert">
          {error}
        </p>
      ) : sortedVlans.length === 0 ? (
        <p className="vlan-matrix__empty">Нет глобальных VLAN.</p>
      ) : sortedDevices.length === 0 ? (
        <p className="vlan-matrix__empty">
          Нет сетевых устройств. Добавьте устройства на вкладке «Топология».
        </p>
      ) : (
        <div className="vlan-matrix__scroll">
          <table className="vlan-matrix__table">
            <thead>
              <tr>
                <th className="vlan-matrix__corner" scope="col">
                  Устройство
                </th>
                {sortedVlans.map((v) => (
                  <th
                    key={v.vlanId}
                    className={
                      v.isProtected
                        ? 'vlan-matrix__col-head vlan-matrix__col-head--protected'
                        : 'vlan-matrix__col-head'
                    }
                    scope="col"
                  >
                    <div className="vlan-matrix__col-head-inner">
                      <button
                        type="button"
                        className="vlan-matrix__col-protect-btn"
                        disabled={
                          protectTogglingId === v.vlanId ||
                          editingVlanId === v.vlanId
                        }
                        title={
                          v.isProtected
                            ? `VLAN ${v.vlanId}: защищён. Нажмите, чтобы снять защиту`
                            : `VLAN ${v.vlanId}. Нажмите, чтобы сделать защищённым`
                        }
                        aria-label={
                          protectTogglingId === v.vlanId
                            ? `VLAN ${v.vlanId}: обновление защиты…`
                            : v.isProtected
                              ? `VLAN ${v.vlanId}: снять защиту`
                              : `VLAN ${v.vlanId}: сделать защищённым`
                        }
                        onClick={() => void toggleVlanProtected(v)}
                      >
                        <span className="vlan-matrix__col-vid">{v.vlanId}</span>
                        {protectTogglingId === v.vlanId ? (
                          <span className="vlan-matrix__col-head-busy">…</span>
                        ) : null}
                      </button>
                      {editingVlanId === v.vlanId ? (
                        <form
                          className="vlan-matrix__col-name-form"
                          onSubmit={(e) => void submitVlanName(e, v.vlanId)}
                        >
                          <input
                            type="text"
                            className="vlan-matrix__col-name-input"
                            maxLength={256}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            disabled={nameSaveBusy}
                            placeholder="имя"
                            autoFocus
                            aria-label={`Имя VLAN ${v.vlanId}`}
                          />
                          <div className="vlan-matrix__col-name-actions">
                            <button
                              type="submit"
                              className="vlan-matrix__col-name-action vlan-matrix__col-name-action--save"
                              disabled={nameSaveBusy}
                            >
                              {nameSaveBusy ? '…' : 'OK'}
                            </button>
                            <button
                              type="button"
                              className="vlan-matrix__col-name-action"
                              disabled={nameSaveBusy}
                              onClick={cancelEditVlanName}
                            >
                              Отм.
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="vlan-matrix__col-name-btn"
                          disabled={
                            nameSaveBusy ||
                            protectTogglingId != null ||
                            (editingVlanId != null && editingVlanId !== v.vlanId)
                          }
                          title={
                            v.name
                              ? `Имя: ${v.name}. Нажмите, чтобы изменить`
                              : 'Задать имя VLAN'
                          }
                          aria-label={
                            v.name
                              ? `VLAN ${v.vlanId}, имя «${v.name}». Изменить имя`
                              : `VLAN ${v.vlanId}. Задать имя`
                          }
                          onClick={() => startEditVlanName(v)}
                        >
                          {v.name ? (
                            <span className="vlan-matrix__col-name" title={v.name}>
                              {v.name}
                            </span>
                          ) : (
                            <span className="vlan-matrix__col-name-placeholder">
                              имя
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDevices.map((d) => (
                <tr key={d.id}>
                  <th className="vlan-matrix__row-head" scope="row">
                    {d.hostname}
                  </th>
                  {sortedVlans.map((v) => (
                    <VlanMatrixCell
                      key={v.vlanId}
                      deviceId={d.id}
                      vlanId={v.vlanId}
                      hostname={d.hostname}
                      present={presence.has(presenceKey(d.id, v.vlanId))}
                      vlanProtected={v.isProtected}
                      pending={pending}
                      toggling={toggling}
                      onActivate={handleCellActivate}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
