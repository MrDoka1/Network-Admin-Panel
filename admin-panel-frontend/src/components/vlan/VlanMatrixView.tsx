import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createDeviceVlan,
  deleteDeviceVlan,
  fetchDeviceVlans,
  fetchDevices,
  fetchVlans,
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

  const [pending, setPending] = useState<VlanMatrixPending | null>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
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

  return (
    <div className="vlan-matrix">
      <header className="vlan-matrix__header">
        <h1>VLAN</h1>
        {toggleError ? (
          <p className="vlan-matrix__error" role="alert">
            {toggleError}
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
                  <th key={v.vlanId} className="vlan-matrix__col-head" scope="col">
                    {v.vlanId}
                    {v.name ? (
                      <span className="vlan-matrix__col-name" title={v.name}>
                        {v.name}
                      </span>
                    ) : null}
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
