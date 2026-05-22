import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  deleteLink,
  fetchDeviceVlans,
  loadNetworkTopology,
} from '../../api/networkClient'
import type {
  DeviceInterface,
  DeviceType,
  DeviceVlan,
  Link,
  NetworkDevice,
} from '../../types/network'
import { formatPhysicalL2Summary } from '../../utils/portVlanLabels'
import { splitHostAndCidrMask } from '../../utils/ipv4Cidr'
import { DeviceModal } from './DeviceModal'
import { LinkModal } from './LinkModal'
import './DeviceModal.css'
import './NetworkDeviceInventoryView.css'

type Panel = 'devices' | 'links'

type DeviceModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; device: NetworkDevice }

type LinkModalState = null | {
  deviceA: NetworkDevice
  deviceB: NetworkDevice
}

const CONFIG: Record<
  DeviceType,
  {
    title: string
    subtitle: string
    emptyTitle: string
    emptyText: string
    addFirst: string
    cardClass: string
    typeLabel: string
  }
> = {
  ROUTER: {
    title: 'Маршрутизаторы',
    subtitle:
      'Маршрутизаторы инфраструктуры: управление, порты, L3 и связи с другими узлами. Позиции на схеме — вкладка «Топология».',
    emptyTitle: 'Пока нет маршрутизаторов',
    emptyText:
      'Добавьте устройство с IP управления и настройте порты в карточке узла.',
    addFirst: 'Добавить маршрутизатор',
    cardClass: 'net-inv__card--router',
    typeLabel: 'Маршрутизатор',
  },
  SWITCH: {
    title: 'Коммутаторы',
    subtitle:
      'Коммутаторы L2/L3: порты, VLAN на интерфейсах и линки к соседним устройствам. VLAN на устройстве — вкладка «VLAN».',
    emptyTitle: 'Пока нет коммутаторов',
    emptyText:
      'Добавьте коммутатор, назначьте порты и при необходимости свяжите их линком.',
    addFirst: 'Добавить коммутатор',
    cardClass: 'net-inv__card--switch',
    typeLabel: 'Коммутатор',
  },
}

type Props = {
  deviceType: DeviceType
}

function sortDevices(devices: NetworkDevice[]): NetworkDevice[] {
  return [...devices].sort((a, b) =>
    a.hostname.localeCompare(b.hostname, undefined, { sensitivity: 'base' }),
  )
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

function deviceStatusLabel(status: NetworkDevice['status']): string {
  return status === 'ACTIVE' ? 'Активно' : 'Неактивно'
}

function adminStatusLabel(status: DeviceInterface['adminStatus']): string {
  return status === 'UP' ? 'Вкл.' : 'Выкл.'
}

function linkEndpointsLabel(
  link: Link,
  devices: NetworkDevice[],
  interfaces: DeviceInterface[],
): string {
  const byId = new Map(interfaces.map((i) => [i.id, i]))
  const devById = new Map(devices.map((d) => [d.id, d]))
  const part = (ifaceId: string) => {
    const i = byId.get(ifaceId)
    if (!i) return ifaceId
    const d = devById.get(i.deviceId)
    return d ? `${d.hostname} · ${i.name}` : i.name
  }
  return `${part(link.interfaceAId)} ↔ ${part(link.interfaceBId)}`
}

function formatPortPeer(
  interfaceId: string,
  links: Link[],
  interfaces: DeviceInterface[],
  devices: NetworkDevice[],
): string | null {
  const ifaceById = new Map(interfaces.map((i) => [i.id, i]))
  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const parts: string[] = []
  for (const link of links) {
    let otherId: string | null = null
    if (link.interfaceAId === interfaceId) otherId = link.interfaceBId
    else if (link.interfaceBId === interfaceId) otherId = link.interfaceAId
    else continue
    const oi = ifaceById.get(otherId)
    if (!oi) continue
    const od = deviceById.get(oi.deviceId)
    parts.push(`${od?.hostname ?? '?'} · ${oi.name}`)
  }
  return parts.length > 0 ? parts.join('; ') : null
}

function LinkPickModal({
  open,
  devices,
  onClose,
  onConfirm,
}: {
  open: boolean
  devices: NetworkDevice[]
  onClose: () => void
  onConfirm: (a: NetworkDevice, b: NetworkDevice) => void
}) {
  const titleId = useId()
  const sorted = useMemo(() => sortDevices(devices), [devices])
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const a = sorted[0]?.id ?? ''
    const b = sorted[1]?.id ?? sorted[0]?.id ?? ''
    setIdA(a)
    setIdB(b)
  }, [open, sorted])

  if (!open) return null

  const devA = sorted.find((d) => d.id === idA)
  const devB = sorted.find((d) => d.id === idB)

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
        onClick={(e) => e.stopPropagation()}
      >
        <header className="device-modal__header">
          <h2 className="device-modal__title" id={titleId}>
            Новый линк — выбор устройств
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
        <div className="device-modal__form">
          {sorted.length < 2 ? (
            <p className="device-modal__error">
              Нужно минимум два устройства в модели.
            </p>
          ) : (
            <>
              <div className="device-modal__field">
                <label htmlFor="link-pick-a">Устройство A</label>
                <select
                  id="link-pick-a"
                  value={idA}
                  onChange={(e) => setIdA(e.target.value)}
                >
                  {sorted.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.hostname} (
                      {d.deviceType === 'ROUTER' ? 'маршр.' : 'коммут.'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="device-modal__field">
                <label htmlFor="link-pick-b">Устройство B</label>
                <select
                  id="link-pick-b"
                  value={idB}
                  onChange={(e) => setIdB(e.target.value)}
                >
                  {sorted.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.hostname} (
                      {d.deviceType === 'ROUTER' ? 'маршр.' : 'коммут.'})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {error ? <p className="device-modal__error">{error}</p> : null}
          <div className="device-modal__actions">
            <button
              type="button"
              className="device-modal__btn device-modal__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="button"
              className="device-modal__btn device-modal__btn--primary"
              disabled={sorted.length < 2}
              onClick={() => {
                if (!devA || !devB) return
                if (devA.id === devB.id) {
                  setError('Выберите два разных устройства.')
                  return
                }
                onConfirm(devA, devB)
              }}
            >
              Далее — выбор портов
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const NetworkDeviceInventoryView = memo(function NetworkDeviceInventoryView({
  deviceType,
}: Props) {
  const cfg = CONFIG[deviceType]
  const [allDevices, setAllDevices] = useState<NetworkDevice[]>([])
  const [interfaces, setInterfaces] = useState<DeviceInterface[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [deviceVlans, setDeviceVlans] = useState<DeviceVlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('devices')
  const [search, setSearch] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>(null)
  const [linkPickOpen, setLinkPickOpen] = useState(false)
  const [linkModal, setLinkModal] = useState<LinkModalState>(null)

  const typedDevices = useMemo(
    () => allDevices.filter((d) => d.deviceType === deviceType),
    [allDevices, deviceType],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [topology, dv] = await Promise.all([
        loadNetworkTopology(),
        fetchDeviceVlans(),
      ])
      setAllDevices(topology.devices)
      setInterfaces(topology.interfaces)
      setLinks(topology.links)
      setDeviceVlans(dv)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedDevices = useMemo(() => sortDevices(typedDevices), [typedDevices])

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedDevices
    return sortedDevices.filter((d) => {
      const { host } = splitHostAndCidrMask(d.mgmtIp)
      return (
        d.hostname.toLowerCase().includes(q) ||
        host.toLowerCase().includes(q) ||
        d.mgmtIp.toLowerCase().includes(q)
      )
    })
  }, [sortedDevices, search])

  const interfacesByDevice = useMemo(() => {
    const map = new Map<string, DeviceInterface[]>()
    for (const i of interfaces) {
      const list = map.get(i.deviceId) ?? []
      list.push(i)
      map.set(i.deviceId, list)
    }
    return map
  }, [interfaces])

  const vlanCountByDevice = useMemo(() => {
    const counts = new Map<string, number>()
    for (const dv of deviceVlans) {
      counts.set(dv.deviceId, (counts.get(dv.deviceId) ?? 0) + 1)
    }
    return counts
  }, [deviceVlans])

  const typedDeviceIds = useMemo(
    () => new Set(typedDevices.map((d) => d.id)),
    [typedDevices],
  )

  const linkCountByDevice = useMemo(() => {
    const counts = new Map<string, number>()
    const ifaceById = new Map(interfaces.map((i) => [i.id, i]))
    for (const link of links) {
      for (const ifaceId of [link.interfaceAId, link.interfaceBId]) {
        const i = ifaceById.get(ifaceId)
        if (!i || !typedDeviceIds.has(i.deviceId)) continue
        counts.set(i.deviceId, (counts.get(i.deviceId) ?? 0) + 1)
      }
    }
    return counts
  }, [links, interfaces, typedDeviceIds])

  const relevantLinks = useMemo(() => {
    const ifaceById = new Map(interfaces.map((i) => [i.id, i]))
    return links.filter((link) => {
      const ia = ifaceById.get(link.interfaceAId)
      const ib = ifaceById.get(link.interfaceBId)
      return (
        (ia && typedDeviceIds.has(ia.deviceId)) ||
        (ib && typedDeviceIds.has(ib.deviceId))
      )
    })
  }, [links, interfaces, typedDeviceIds])

  const sortedLinks = useMemo(() => {
    return [...relevantLinks].sort((a, b) =>
      linkEndpointsLabel(a, allDevices, interfaces).localeCompare(
        linkEndpointsLabel(b, allDevices, interfaces),
        undefined,
        { sensitivity: 'base' },
      ),
    )
  }, [relevantLinks, allDevices, interfaces])

  const busyInterfaceIds = useMemo(
    () => new Set(links.flatMap((l) => [l.interfaceAId, l.interfaceBId])),
    [links],
  )

  useEffect(() => {
    if (filteredDevices.length === 0) {
      setSelectedDeviceId(null)
      return
    }
    const stillVisible = filteredDevices.some((d) => d.id === selectedDeviceId)
    if (!stillVisible) {
      setSelectedDeviceId(filteredDevices[0].id)
    }
  }, [filteredDevices, selectedDeviceId])

  const selectedDevice = useMemo(
    () => typedDevices.find((d) => d.id === selectedDeviceId) ?? null,
    [typedDevices, selectedDeviceId],
  )

  const selectedInterfaces = useMemo(
    () =>
      selectedDeviceId
        ? sortInterfacesForDisplay(
            interfacesByDevice.get(selectedDeviceId) ?? [],
          )
        : [],
    [interfacesByDevice, selectedDeviceId],
  )

  const selectedLinks = useMemo(() => {
    if (!selectedDeviceId) return []
    const ifaceIds = new Set(
      (interfacesByDevice.get(selectedDeviceId) ?? []).map((i) => i.id),
    )
    return links.filter(
      (l) => ifaceIds.has(l.interfaceAId) || ifaceIds.has(l.interfaceBId),
    )
  }, [links, interfacesByDevice, selectedDeviceId])

  const activeCount = useMemo(
    () => typedDevices.filter((d) => d.status === 'ACTIVE').length,
    [typedDevices],
  )

  const portCount = useMemo(() => {
    let n = 0
    for (const d of typedDevices) {
      n += interfacesByDevice.get(d.id)?.length ?? 0
    }
    return n
  }, [typedDevices, interfacesByDevice])

  async function handleDeleteLink(link: Link) {
    if (!window.confirm('Удалить этот линк?')) return
    try {
      await deleteLink(link.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const linkContext = useMemo(
    () => ({
      links,
      allInterfaces: interfaces,
      devices: allDevices,
    }),
    [links, interfaces, allDevices],
  )

  return (
    <div className={`net-inv net-inv--${deviceType.toLowerCase()}`}>
      <header className="net-inv__header">
        <div className="net-inv__title-block">
          <h1>{cfg.title}</h1>
          <p className="net-inv__subtitle">{cfg.subtitle}</p>
        </div>
        <div className="net-inv__actions">
          <button
            type="button"
            className="net-inv__btn net-inv__btn--primary"
            onClick={() => setDeviceModal({ mode: 'create' })}
          >
            Добавить устройство
          </button>
          <button
            type="button"
            className="net-inv__btn"
            onClick={() => setLinkPickOpen(true)}
            disabled={allDevices.length < 2}
          >
            Создать линк
          </button>
          <button
            type="button"
            className="net-inv__btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
        <div className="net-inv__stats" aria-label="Сводка">
          <div className="net-inv__stat">
            <span className="net-inv__stat-value">{typedDevices.length}</span>
            <span className="net-inv__stat-label">устройств</span>
          </div>
          <div className="net-inv__stat">
            <span className="net-inv__stat-value">{activeCount}</span>
            <span className="net-inv__stat-label">активных</span>
          </div>
          <div className="net-inv__stat">
            <span className="net-inv__stat-value">{portCount}</span>
            <span className="net-inv__stat-label">портов</span>
          </div>
          <div className="net-inv__stat">
            <span className="net-inv__stat-value">{relevantLinks.length}</span>
            <span className="net-inv__stat-label">линков</span>
          </div>
        </div>
        {error ? (
          <p className="net-inv__error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <div className="net-inv__toolbar">
        <div
          className="net-inv__subtabs"
          role="tablist"
          aria-label="Разделы инвентаря"
        >
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'devices'}
            className={
              panel === 'devices'
                ? 'net-inv__subtab net-inv__subtab--active'
                : 'net-inv__subtab'
            }
            onClick={() => setPanel('devices')}
          >
            Устройства
            <span className="net-inv__subtab-count">{typedDevices.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'links'}
            className={
              panel === 'links'
                ? 'net-inv__subtab net-inv__subtab--active'
                : 'net-inv__subtab'
            }
            onClick={() => setPanel('links')}
          >
            Линки
            <span className="net-inv__subtab-count">
              {relevantLinks.length}
            </span>
          </button>
        </div>
        {panel === 'devices' ? (
          <label className="net-inv__search">
            <span className="net-inv__search-label">Поиск</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя или IP управления…"
              autoComplete="off"
              disabled={loading && typedDevices.length === 0}
            />
          </label>
        ) : null}
      </div>

      <div className="net-inv__body">
        {loading && typedDevices.length === 0 && relevantLinks.length === 0 ? (
          <p className="net-inv__placeholder">Загрузка…</p>
        ) : null}

        {panel === 'devices' ? (
          <>
            {!loading && typedDevices.length === 0 ? (
              <div className="net-inv__empty">
                <p className="net-inv__empty-title">{cfg.emptyTitle}</p>
                <p className="net-inv__empty-text">{cfg.emptyText}</p>
                <button
                  type="button"
                  className="net-inv__btn net-inv__btn--primary"
                  onClick={() => setDeviceModal({ mode: 'create' })}
                >
                  {cfg.addFirst}
                </button>
              </div>
            ) : null}

            {typedDevices.length > 0 ? (
              <div className="net-inv__split">
                <aside className="net-inv__list" aria-label="Список устройств">
                  {filteredDevices.length === 0 ? (
                    <p className="net-inv__list-empty">
                      Ничего не найдено по запросу «{search.trim()}».
                    </p>
                  ) : null}
                  <ul className="net-inv__cards">
                    {filteredDevices.map((d) => {
                      const ifCount = interfacesByDevice.get(d.id)?.length ?? 0
                      const linkCount = linkCountByDevice.get(d.id) ?? 0
                      const vlanCount = vlanCountByDevice.get(d.id) ?? 0
                      const selected = d.id === selectedDeviceId
                      const { host } = splitHostAndCidrMask(d.mgmtIp)
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            className={
                              selected
                                ? `net-inv__card net-inv__card--selected ${cfg.cardClass}`
                                : `net-inv__card ${cfg.cardClass}`
                            }
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => setSelectedDeviceId(d.id)}
                          >
                            <span className="net-inv__card-host">
                              {d.hostname}
                            </span>
                            <span
                              className={
                                d.status === 'ACTIVE'
                                  ? 'net-inv__pill net-inv__pill--ok'
                                  : 'net-inv__pill net-inv__pill--muted'
                              }
                            >
                              {deviceStatusLabel(d.status)}
                            </span>
                            <span className="net-inv__card-ip">{host}</span>
                            <span className="net-inv__card-meta">
                              {ifCount} порт.
                              {vlanCount > 0 ? ` · ${vlanCount} VLAN` : ''}
                              {linkCount > 0 ? ` · ${linkCount} линк.` : ''}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </aside>

                <section
                  className="net-inv__detail"
                  aria-label="Детали устройства"
                >
                  {!selectedDevice ? (
                    <p className="net-inv__placeholder">
                      Выберите устройство в списке слева.
                    </p>
                  ) : (
                    <>
                      <div className="net-inv__detail-head">
                        <div>
                          <h2 className="net-inv__detail-title">
                            {selectedDevice.hostname}
                          </h2>
                          <p className="net-inv__detail-sub">
                            <span className="net-inv__type-badge">
                              {cfg.typeLabel}
                            </span>
                            <span className="net-inv__detail-sub-sep">·</span>
                            <span
                              className={
                                selectedDevice.status === 'ACTIVE'
                                  ? 'net-inv__pill net-inv__pill--ok'
                                  : 'net-inv__pill net-inv__pill--muted'
                              }
                            >
                              {deviceStatusLabel(selectedDevice.status)}
                            </span>
                            <span className="net-inv__detail-sub-sep">·</span>
                            <code className="net-inv__mgmt-ip">
                              {splitHostAndCidrMask(selectedDevice.mgmtIp).host}
                            </code>
                          </p>
                        </div>
                        <div className="net-inv__detail-actions">
                          <button
                            type="button"
                            className="net-inv__btn net-inv__btn--primary"
                            onClick={() =>
                              setDeviceModal({
                                mode: 'edit',
                                device: selectedDevice,
                              })
                            }
                          >
                            Настройки и порты
                          </button>
                        </div>
                      </div>

                      <div className="net-inv__detail-block">
                        <h3 className="net-inv__block-title">Порты</h3>
                        {selectedInterfaces.length === 0 ? (
                          <p className="net-inv__muted">
                            Нет портов. Откройте «Настройки и порты», чтобы
                            добавить интерфейсы.
                          </p>
                        ) : (
                          <div className="net-inv__table-wrap">
                            <table className="net-inv__table">
                              <thead>
                                <tr>
                                  <th>Имя</th>
                                  <th>Admin</th>
                                  <th>L2 / VLAN</th>
                                  <th>IP</th>
                                  <th>Сосед</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedInterfaces.map((i) => {
                                  const peer = formatPortPeer(
                                    i.id,
                                    links,
                                    interfaces,
                                    allDevices,
                                  )
                                  const isSub = !!i.parentInterfaceId
                                  return (
                                    <tr
                                      key={i.id}
                                      className={
                                        isSub ? 'net-inv__row--sub' : undefined
                                      }
                                    >
                                      <td>
                                        {isSub ? (
                                          <span className="net-inv__sub-name">
                                            ↳ {i.name}
                                            {i.dot1qVlanId != null
                                              ? ` (${i.dot1qVlanId})`
                                              : ''}
                                          </span>
                                        ) : (
                                          i.name
                                        )}
                                      </td>
                                      <td>
                                        <span
                                          className={
                                            i.adminStatus === 'UP'
                                              ? 'net-inv__pill net-inv__pill--ok net-inv__pill--sm'
                                              : 'net-inv__pill net-inv__pill--sm'
                                          }
                                        >
                                          {adminStatusLabel(i.adminStatus)}
                                        </span>
                                      </td>
                                      <td className="net-inv__l2">
                                        {!isSub
                                          ? formatPhysicalL2Summary(
                                              i.vlanBinding,
                                            )
                                          : '—'}
                                      </td>
                                      <td>
                                        {i.ipAddress ? (
                                          <code>{i.ipAddress}</code>
                                        ) : (
                                          <span className="net-inv__muted-inline">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {peer ? (
                                          <span className="net-inv__linked">
                                            {peer}
                                          </span>
                                        ) : (
                                          <span className="net-inv__unlinked">
                                            свободен
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {selectedLinks.length > 0 ? (
                        <div className="net-inv__detail-block">
                          <h3 className="net-inv__block-title">Линки</h3>
                          <ul className="net-inv__link-list">
                            {selectedLinks.map((l) => (
                              <li key={l.id} className="net-inv__link-row">
                                <span className="net-inv__link-label">
                                  {linkEndpointsLabel(
                                    l,
                                    allDevices,
                                    interfaces,
                                  )}
                                </span>
                                <span className="net-inv__link-actions">
                                  <button
                                    type="button"
                                    className="net-inv__btn-inline net-inv__btn-inline--danger"
                                    onClick={() => void handleDeleteLink(l)}
                                  >
                                    Удалить
                                  </button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {panel === 'links' ? (
          <>
            {!loading && relevantLinks.length === 0 ? (
              <div className="net-inv__empty">
                <p className="net-inv__empty-title">Нет линков</p>
                <p className="net-inv__empty-text">
                  Линк соединяет порт одного устройства с портом другого
                  (отображается на топологии).
                </p>
                <button
                  type="button"
                  className="net-inv__btn net-inv__btn--primary"
                  onClick={() => setLinkPickOpen(true)}
                  disabled={allDevices.length < 2}
                >
                  Создать линк
                </button>
              </div>
            ) : null}

            {relevantLinks.length > 0 ? (
              <div className="net-inv__attachments">
                <ul className="net-inv__attach-list">
                  {sortedLinks.map((l) => (
                    <li key={l.id} className="net-inv__attach-card">
                      <span className="net-inv__attach-value">
                        {linkEndpointsLabel(l, allDevices, interfaces)}
                      </span>
                      <div className="net-inv__attach-actions">
                        <button
                          type="button"
                          className="net-inv__btn-inline net-inv__btn-inline--danger"
                          onClick={() => void handleDeleteLink(l)}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {deviceModal ? (
        <DeviceModal
          mode={deviceModal.mode}
          device={deviceModal.mode === 'edit' ? deviceModal.device : null}
          open
          fixedDeviceType={
            deviceModal.mode === 'create' ? deviceType : undefined
          }
          linkContext={linkContext}
          onClose={() => setDeviceModal(null)}
          onPortsChanged={() => void load()}
          onSaved={() => {
            setDeviceModal(null)
            void load()
          }}
        />
      ) : null}

      <LinkPickModal
        open={linkPickOpen}
        devices={allDevices}
        onClose={() => setLinkPickOpen(false)}
        onConfirm={(a, b) => {
          setLinkPickOpen(false)
          setLinkModal({ deviceA: a, deviceB: b })
        }}
      />

      {linkModal ? (
        <LinkModal
          deviceA={linkModal.deviceA}
          deviceB={linkModal.deviceB}
          interfacesA={interfacesByDevice.get(linkModal.deviceA.id) ?? []}
          interfacesB={interfacesByDevice.get(linkModal.deviceB.id) ?? []}
          busyInterfaceIds={busyInterfaceIds}
          open
          onTopologyChanged={() => void load()}
          onClose={() => setLinkModal(null)}
          onCreated={() => {
            setLinkModal(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
})

export const RouterInventoryView = memo(function RouterInventoryView() {
  return <NetworkDeviceInventoryView deviceType="ROUTER" />
})

export const SwitchInventoryView = memo(function SwitchInventoryView() {
  return <NetworkDeviceInventoryView deviceType="SWITCH" />
})
