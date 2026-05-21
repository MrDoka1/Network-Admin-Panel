import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEndpointAttachment,
  createEndpointDevice,
  createEndpointInterface,
  deleteEndpointAttachment,
  deleteEndpointDevice,
  deleteEndpointInterface,
  loadEndpointInventory,
  updateEndpointAttachment,
  updateEndpointDevice,
  updateEndpointInterface,
} from '../../api/networkClient'
import type {
  EndpointDevice,
  EndpointDeviceInterface,
  EndpointNetworkAttachment,
} from '../../types/endpoint'
import type { DeviceInterface, Link, NetworkDevice } from '../../types/network'
import { EndpointAttachmentModal } from './EndpointAttachmentModal'
import { EndpointDeviceModal } from './EndpointDeviceModal'
import { EndpointInterfacesModal } from './EndpointInterfacesModal'
import './EndpointInventoryView.css'

type Panel = 'devices' | 'attachments'

type DeviceModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; device: EndpointDevice }

type InterfacesModalState = null | { device: EndpointDevice }

type AttachmentModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; attachment: EndpointNetworkAttachment }

function netIfaceLabel(
  ifaceId: string,
  networkDevices: NetworkDevice[],
  networkInterfaces: DeviceInterface[],
): string {
  const i = networkInterfaces.find((x) => x.id === ifaceId)
  if (!i) return ifaceId
  const d = networkDevices.find((x) => x.id === i.deviceId)
  return d ? `${d.hostname} · ${i.name}` : i.name
}

function epIfaceLabel(
  ifaceId: string,
  endpointDevices: EndpointDevice[],
  endpointInterfaces: EndpointDeviceInterface[],
): string {
  const i = endpointInterfaces.find((x) => x.id === ifaceId)
  if (!i) return ifaceId
  const d = endpointDevices.find((x) => x.id === i.endpointDeviceId)
  return d ? `${d.hostname} · ${i.name}` : i.name
}

function deviceStatusLabel(status: EndpointDevice['status']): string {
  return status === 'ACTIVE' ? 'Активно' : 'Неактивно'
}

function adminStatusLabel(status: EndpointDeviceInterface['adminStatus']): string {
  return status === 'UP' ? 'Вкл.' : 'Выкл.'
}

function sortDevices(devices: EndpointDevice[]): EndpointDevice[] {
  return [...devices].sort((a, b) =>
    a.hostname.localeCompare(b.hostname, undefined, { sensitivity: 'base' }),
  )
}

export const EndpointInventoryView = memo(function EndpointInventoryView() {
  const [endpointDevices, setEndpointDevices] = useState<EndpointDevice[]>([])
  const [endpointInterfaces, setEndpointInterfaces] = useState<
    EndpointDeviceInterface[]
  >([])
  const [attachments, setAttachments] = useState<EndpointNetworkAttachment[]>(
    [],
  )
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([])
  const [networkInterfaces, setNetworkInterfaces] = useState<DeviceInterface[]>(
    [],
  )
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('devices')
  const [search, setSearch] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>(null)
  const [interfacesModal, setInterfacesModal] =
    useState<InterfacesModalState>(null)
  const [attachmentModal, setAttachmentModal] =
    useState<AttachmentModalState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await loadEndpointInventory()
      setEndpointDevices(d.endpointDevices)
      setEndpointInterfaces(d.endpointInterfaces)
      setAttachments(d.attachments)
      setNetworkDevices(d.networkDevices)
      setNetworkInterfaces(d.networkInterfaces)
      setLinks(d.links)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedDevices = useMemo(
    () => sortDevices(endpointDevices),
    [endpointDevices],
  )

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedDevices
    return sortedDevices.filter((d) => d.hostname.toLowerCase().includes(q))
  }, [sortedDevices, search])

  const interfacesByDevice = useMemo(() => {
    const map = new Map<string, EndpointDeviceInterface[]>()
    for (const i of endpointInterfaces) {
      const list = map.get(i.endpointDeviceId) ?? []
      list.push(i)
      map.set(i.endpointDeviceId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
    }
    return map
  }, [endpointInterfaces])

  const attachmentByEndpointIface = useMemo(() => {
    const map = new Map<string, EndpointNetworkAttachment>()
    for (const a of attachments) {
      map.set(a.endpointInterfaceId, a)
    }
    return map
  }, [attachments])

  const attachmentCountByDevice = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of endpointInterfaces) {
      if (!attachmentByEndpointIface.has(i.id)) continue
      counts.set(i.endpointDeviceId, (counts.get(i.endpointDeviceId) ?? 0) + 1)
    }
    return counts
  }, [endpointInterfaces, attachmentByEndpointIface])

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
    () => endpointDevices.find((d) => d.id === selectedDeviceId) ?? null,
    [endpointDevices, selectedDeviceId],
  )

  const selectedInterfaces = useMemo(
    () =>
      selectedDeviceId
        ? (interfacesByDevice.get(selectedDeviceId) ?? [])
        : [],
    [interfacesByDevice, selectedDeviceId],
  )

  const selectedAttachments = useMemo(() => {
    if (!selectedDeviceId) return []
    const ifaceIds = new Set(
      (interfacesByDevice.get(selectedDeviceId) ?? []).map((i) => i.id),
    )
    return attachments.filter((a) => ifaceIds.has(a.endpointInterfaceId))
  }, [attachments, interfacesByDevice, selectedDeviceId])

  const interfacesForDevice = useCallback(
    (deviceId: string) => interfacesByDevice.get(deviceId) ?? [],
    [interfacesByDevice],
  )

  async function handleDeleteDevice(d: EndpointDevice) {
    if (!window.confirm(`Удалить устройство «${d.hostname}» и все его NIC?`)) {
      return
    }
    try {
      await deleteEndpointDevice(d.id)
      if (selectedDeviceId === d.id) setSelectedDeviceId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDeleteAttachment(a: EndpointNetworkAttachment) {
    if (!window.confirm('Удалить это подключение?')) return
    try {
      await deleteEndpointAttachment(a.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const sortedAttachments = useMemo(() => {
    return [...attachments].sort((a, b) => {
      const la = epIfaceLabel(
        a.endpointInterfaceId,
        endpointDevices,
        endpointInterfaces,
      )
      const lb = epIfaceLabel(
        b.endpointInterfaceId,
        endpointDevices,
        endpointInterfaces,
      )
      return la.localeCompare(lb, undefined, { sensitivity: 'base' })
    })
  }, [attachments, endpointDevices, endpointInterfaces])

  const activeCount = useMemo(
    () => endpointDevices.filter((d) => d.status === 'ACTIVE').length,
    [endpointDevices],
  )

  const connectedNicCount = attachments.length

  return (
    <div className="endpoint-inv">
      <header className="endpoint-inv__header">
        <div className="endpoint-inv__title-block">
          <h1>Оконечные устройства</h1>
          <p className="endpoint-inv__subtitle">
            Хосты на периферии сети: NIC, MAC и привязка к портам коммутаторов.
            Узлы отображаются на вкладке «Топология».
          </p>
        </div>
        <div className="endpoint-inv__actions">
          <button
            type="button"
            className="endpoint-inv__btn endpoint-inv__btn--primary"
            onClick={() => setDeviceModal({ mode: 'create' })}
          >
            Добавить устройство
          </button>
          <button
            type="button"
            className="endpoint-inv__btn"
            onClick={() => setAttachmentModal({ mode: 'create' })}
          >
            Подключить к сети
          </button>
          <button
            type="button"
            className="endpoint-inv__btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
        <div className="endpoint-inv__stats" aria-label="Сводка">
          <div className="endpoint-inv__stat">
            <span className="endpoint-inv__stat-value">
              {endpointDevices.length}
            </span>
            <span className="endpoint-inv__stat-label">устройств</span>
          </div>
          <div className="endpoint-inv__stat">
            <span className="endpoint-inv__stat-value">{activeCount}</span>
            <span className="endpoint-inv__stat-label">активных</span>
          </div>
          <div className="endpoint-inv__stat">
            <span className="endpoint-inv__stat-value">
              {endpointInterfaces.length}
            </span>
            <span className="endpoint-inv__stat-label">NIC</span>
          </div>
          <div className="endpoint-inv__stat">
            <span className="endpoint-inv__stat-value">
              {connectedNicCount}
            </span>
            <span className="endpoint-inv__stat-label">подключено</span>
          </div>
        </div>
        {error ? (
          <p className="endpoint-inv__error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <div className="endpoint-inv__toolbar">
        <div
          className="endpoint-inv__subtabs"
          role="tablist"
          aria-label="Разделы инвентаря"
        >
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'devices'}
            className={
              panel === 'devices'
                ? 'endpoint-inv__subtab endpoint-inv__subtab--active'
                : 'endpoint-inv__subtab'
            }
            onClick={() => setPanel('devices')}
          >
            Устройства
            <span className="endpoint-inv__subtab-count">
              {endpointDevices.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'attachments'}
            className={
              panel === 'attachments'
                ? 'endpoint-inv__subtab endpoint-inv__subtab--active'
                : 'endpoint-inv__subtab'
            }
            onClick={() => setPanel('attachments')}
          >
            Подключения
            <span className="endpoint-inv__subtab-count">
              {attachments.length}
            </span>
          </button>
        </div>
        {panel === 'devices' ? (
          <label className="endpoint-inv__search">
            <span className="endpoint-inv__search-label">Поиск</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя хоста…"
              autoComplete="off"
              disabled={loading && endpointDevices.length === 0}
            />
          </label>
        ) : null}
      </div>

      <div className="endpoint-inv__body">
        {loading && endpointDevices.length === 0 && attachments.length === 0 ? (
          <p className="endpoint-inv__placeholder">Загрузка…</p>
        ) : null}

        {panel === 'devices' ? (
          <>
            {!loading && endpointDevices.length === 0 ? (
              <div className="endpoint-inv__empty">
                <p className="endpoint-inv__empty-title">
                  Пока нет оконечных устройств
                </p>
                <p className="endpoint-inv__empty-text">
                  Создайте хост, добавьте NIC с MAC и при необходимости
                  привяжите интерфейс к порту коммутатора.
                </p>
                <button
                  type="button"
                  className="endpoint-inv__btn endpoint-inv__btn--primary"
                  onClick={() => setDeviceModal({ mode: 'create' })}
                >
                  Добавить первое устройство
                </button>
              </div>
            ) : null}

            {endpointDevices.length > 0 ? (
              <div className="endpoint-inv__split">
                <aside
                  className="endpoint-inv__list"
                  aria-label="Список устройств"
                >
                  {filteredDevices.length === 0 ? (
                    <p className="endpoint-inv__list-empty">
                      Ничего не найдено по запросу «{search.trim()}».
                    </p>
                  ) : null}
                  <ul className="endpoint-inv__cards">
                    {filteredDevices.map((d) => {
                      const nicCount = interfacesForDevice(d.id).length
                      const linkCount = attachmentCountByDevice.get(d.id) ?? 0
                      const selected = d.id === selectedDeviceId
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            className={
                              selected
                                ? 'endpoint-inv__card endpoint-inv__card--selected'
                                : 'endpoint-inv__card'
                            }
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => setSelectedDeviceId(d.id)}
                          >
                            <span className="endpoint-inv__card-host">
                              {d.hostname}
                            </span>
                            <span
                              className={
                                d.status === 'ACTIVE'
                                  ? 'endpoint-inv__pill endpoint-inv__pill--ok'
                                  : 'endpoint-inv__pill endpoint-inv__pill--muted'
                              }
                            >
                              {deviceStatusLabel(d.status)}
                            </span>
                            <span className="endpoint-inv__card-meta">
                              {nicCount} NIC
                              {linkCount > 0 ? ` · ${linkCount} в сети` : ''}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </aside>

                <section
                  className="endpoint-inv__detail"
                  aria-label="Детали устройства"
                >
                  {!selectedDevice ? (
                    <p className="endpoint-inv__placeholder">
                      Выберите устройство в списке слева.
                    </p>
                  ) : (
                    <>
                      <div className="endpoint-inv__detail-head">
                        <div>
                          <h2 className="endpoint-inv__detail-title">
                            {selectedDevice.hostname}
                          </h2>
                          <p className="endpoint-inv__detail-sub">
                            <span
                              className={
                                selectedDevice.status === 'ACTIVE'
                                  ? 'endpoint-inv__pill endpoint-inv__pill--ok'
                                  : 'endpoint-inv__pill endpoint-inv__pill--muted'
                              }
                            >
                              {deviceStatusLabel(selectedDevice.status)}
                            </span>
                            <span className="endpoint-inv__detail-sub-sep">
                              ·
                            </span>
                            {selectedInterfaces.length} интерфейсов
                            {selectedAttachments.length > 0
                              ? ` · ${selectedAttachments.length} в сети`
                              : ''}
                          </p>
                        </div>
                        <div className="endpoint-inv__detail-actions">
                          <button
                            type="button"
                            className="endpoint-inv__btn endpoint-inv__btn--primary"
                            onClick={() =>
                              setInterfacesModal({ device: selectedDevice })
                            }
                          >
                            Управление NIC
                          </button>
                          <button
                            type="button"
                            className="endpoint-inv__btn"
                            onClick={() =>
                              setDeviceModal({
                                mode: 'edit',
                                device: selectedDevice,
                              })
                            }
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="endpoint-inv__btn endpoint-inv__btn--danger"
                            onClick={() =>
                              void handleDeleteDevice(selectedDevice)
                            }
                          >
                            Удалить
                          </button>
                        </div>
                      </div>

                      <div className="endpoint-inv__detail-block">
                        <h3 className="endpoint-inv__block-title">
                          Сетевые интерфейсы (NIC)
                        </h3>
                        {selectedInterfaces.length === 0 ? (
                          <p className="endpoint-inv__muted">
                            Нет NIC. Откройте «Управление NIC», чтобы добавить
                            eth0 и MAC.
                          </p>
                        ) : (
                          <div className="endpoint-inv__table-wrap">
                            <table className="endpoint-inv__table">
                              <thead>
                                <tr>
                                  <th>Имя</th>
                                  <th>MAC</th>
                                  <th>Admin</th>
                                  <th>Порт сети</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedInterfaces.map((i) => {
                                  const att = attachmentByEndpointIface.get(
                                    i.id,
                                  )
                                  return (
                                    <tr key={i.id}>
                                      <td>{i.name}</td>
                                      <td>
                                        <code className="endpoint-inv__mac">
                                          {i.macAddress}
                                        </code>
                                      </td>
                                      <td>
                                        <span
                                          className={
                                            i.adminStatus === 'UP'
                                              ? 'endpoint-inv__pill endpoint-inv__pill--ok endpoint-inv__pill--sm'
                                              : 'endpoint-inv__pill endpoint-inv__pill--sm'
                                          }
                                        >
                                          {adminStatusLabel(i.adminStatus)}
                                        </span>
                                      </td>
                                      <td>
                                        {att ? (
                                          <span className="endpoint-inv__linked">
                                            {netIfaceLabel(
                                              att.networkInterfaceId,
                                              networkDevices,
                                              networkInterfaces,
                                            )}
                                          </span>
                                        ) : (
                                          <span className="endpoint-inv__unlinked">
                                            не подключён
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

                      {selectedAttachments.length > 0 ? (
                        <div className="endpoint-inv__detail-block">
                          <h3 className="endpoint-inv__block-title">
                            Подключения к сети
                          </h3>
                          <ul className="endpoint-inv__link-list">
                            {selectedAttachments.map((a) => (
                              <li key={a.id} className="endpoint-inv__link-row">
                                <span className="endpoint-inv__link-net">
                                  {netIfaceLabel(
                                    a.networkInterfaceId,
                                    networkDevices,
                                    networkInterfaces,
                                  )}
                                </span>
                                <span
                                  className="endpoint-inv__link-arrow"
                                  aria-hidden
                                >
                                  →
                                </span>
                                <span className="endpoint-inv__link-ep">
                                  {epIfaceLabel(
                                    a.endpointInterfaceId,
                                    endpointDevices,
                                    endpointInterfaces,
                                  )}
                                </span>
                                <span className="endpoint-inv__link-actions">
                                  <button
                                    type="button"
                                    className="endpoint-inv__btn-inline"
                                    onClick={() =>
                                      setAttachmentModal({
                                        mode: 'edit',
                                        attachment: a,
                                      })
                                    }
                                  >
                                    Изменить
                                  </button>
                                  <button
                                    type="button"
                                    className="endpoint-inv__btn-inline endpoint-inv__btn-inline--danger"
                                    onClick={() =>
                                      void handleDeleteAttachment(a)
                                    }
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

        {panel === 'attachments' ? (
          <>
            {!loading && attachments.length === 0 ? (
              <div className="endpoint-inv__empty">
                <p className="endpoint-inv__empty-title">
                  Нет подключений к портам
                </p>
                <p className="endpoint-inv__empty-text">
                  Связь связывает порт коммутатора с NIC оконечного устройства
                  (отображается пунктиром на топологии).
                </p>
                <button
                  type="button"
                  className="endpoint-inv__btn endpoint-inv__btn--primary"
                  onClick={() => setAttachmentModal({ mode: 'create' })}
                >
                  Создать подключение
                </button>
              </div>
            ) : null}

            {attachments.length > 0 ? (
              <div className="endpoint-inv__attachments">
                <ul className="endpoint-inv__attach-list">
                  {sortedAttachments.map((a) => (
                    <li key={a.id} className="endpoint-inv__attach-card">
                      <div className="endpoint-inv__attach-flow">
                        <div className="endpoint-inv__attach-end">
                          <span className="endpoint-inv__attach-kind">
                            Порт сети
                          </span>
                          <span className="endpoint-inv__attach-value">
                            {netIfaceLabel(
                              a.networkInterfaceId,
                              networkDevices,
                              networkInterfaces,
                            )}
                          </span>
                        </div>
                        <span
                          className="endpoint-inv__attach-arrow"
                          aria-hidden
                        >
                          ↔
                        </span>
                        <div className="endpoint-inv__attach-end">
                          <span className="endpoint-inv__attach-kind">
                            NIC оконечного
                          </span>
                          <span className="endpoint-inv__attach-value">
                            {epIfaceLabel(
                              a.endpointInterfaceId,
                              endpointDevices,
                              endpointInterfaces,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="endpoint-inv__attach-actions">
                        <button
                          type="button"
                          className="endpoint-inv__btn-inline"
                          onClick={() =>
                            setAttachmentModal({ mode: 'edit', attachment: a })
                          }
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="endpoint-inv__btn-inline endpoint-inv__btn-inline--danger"
                          onClick={() => void handleDeleteAttachment(a)}
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
        <EndpointDeviceModal
          mode={deviceModal.mode}
          device={deviceModal.mode === 'edit' ? deviceModal.device : null}
          open
          onClose={() => setDeviceModal(null)}
          onSaved={() => {
            setDeviceModal(null)
            void load()
          }}
          onSubmit={async (values) => {
            if (deviceModal.mode === 'create') {
              return createEndpointDevice(values)
            }
            return updateEndpointDevice(deviceModal.device.id, values)
          }}
        />
      ) : null}

      {interfacesModal ? (
        <EndpointInterfacesModal
          device={interfacesModal.device}
          interfaces={interfacesForDevice(interfacesModal.device.id)}
          open
          onClose={() => setInterfacesModal(null)}
          onChanged={() => void load()}
          onCreate={async (payload) => {
            await createEndpointInterface(interfacesModal.device.id, payload)
          }}
          onUpdate={async (id, payload) => {
            await updateEndpointInterface(id, payload)
          }}
          onDelete={(id) => deleteEndpointInterface(id)}
        />
      ) : null}

      {attachmentModal ? (
        <EndpointAttachmentModal
          mode={attachmentModal.mode}
          attachment={
            attachmentModal.mode === 'edit'
              ? attachmentModal.attachment
              : null
          }
          open
          endpointDevices={endpointDevices}
          networkDevices={networkDevices}
          networkInterfaces={networkInterfaces}
          endpointInterfaces={endpointInterfaces}
          attachments={attachments}
          links={links}
          onClose={() => setAttachmentModal(null)}
          onSaved={() => {
            setAttachmentModal(null)
            void load()
          }}
          onSubmit={async (payload) => {
            if (attachmentModal.mode === 'create') {
              await createEndpointAttachment(payload)
            } else {
              await updateEndpointAttachment(
                attachmentModal.attachment.id,
                payload,
              )
            }
          }}
        />
      ) : null}
    </div>
  )
})
