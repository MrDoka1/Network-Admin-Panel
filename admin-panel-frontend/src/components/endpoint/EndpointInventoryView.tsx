import { memo, useCallback, useEffect, useState } from 'react'
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
  return d ? `${d.hostname} / ${i.name}` : i.name
}

function epIfaceLabel(
  ifaceId: string,
  endpointDevices: EndpointDevice[],
  endpointInterfaces: EndpointDeviceInterface[],
): string {
  const i = endpointInterfaces.find((x) => x.id === ifaceId)
  if (!i) return ifaceId
  const d = endpointDevices.find((x) => x.id === i.endpointDeviceId)
  return d ? `${d.hostname} / ${i.name}` : i.name
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

  const interfacesForDevice = useCallback(
    (deviceId: string) =>
      endpointInterfaces.filter((i) => i.endpointDeviceId === deviceId),
    [endpointInterfaces],
  )

  async function handleDeleteDevice(d: EndpointDevice) {
    if (!window.confirm(`Удалить устройство «${d.hostname}» и все его NIC?`)) {
      return
    }
    try {
      await deleteEndpointDevice(d.id)
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

  const sortedDevices = [...endpointDevices].sort((a, b) =>
    a.hostname.localeCompare(b.hostname, undefined, { sensitivity: 'base' }),
  )

  return (
    <div className="endpoint-inv">
      <header className="endpoint-inv__header">
        <h1>Оконечные устройства</h1>
        <span className="endpoint-inv__stats">
          {endpointDevices.length} узлов · {endpointInterfaces.length} NIC ·{' '}
          {attachments.length} подключений
        </span>
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
            className="endpoint-inv__btn endpoint-inv__btn--primary"
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
      </header>

      {error ? (
        <p className="endpoint-inv__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="endpoint-inv__section">
        <h2>Устройства</h2>
        {loading && endpointDevices.length === 0 ? (
          <p className="endpoint-inv__muted">Загрузка…</p>
        ) : null}
        {!loading && endpointDevices.length === 0 ? (
          <p className="endpoint-inv__muted">
            Пока нет оконечных устройств. Создайте запись и добавьте NIC с MAC.
          </p>
        ) : null}
        {endpointDevices.length > 0 ? (
          <div className="endpoint-inv__table-wrap">
            <table className="endpoint-inv__table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Статус</th>
                  <th>NIC</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedDevices.map((d) => (
                  <tr key={d.id}>
                    <td>{d.hostname}</td>
                    <td>
                      <span
                        className={
                          d.status === 'ACTIVE'
                            ? 'endpoint-inv__pill endpoint-inv__pill--ok'
                            : 'endpoint-inv__pill'
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>{interfacesForDevice(d.id).length}</td>
                    <td className="endpoint-inv__td-actions">
                      <button
                        type="button"
                        className="endpoint-inv__btn-inline"
                        onClick={() =>
                          setInterfacesModal({ device: d })
                        }
                      >
                        NIC
                      </button>
                      <button
                        type="button"
                        className="endpoint-inv__btn-inline"
                        onClick={() =>
                          setDeviceModal({ mode: 'edit', device: d })
                        }
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="endpoint-inv__btn-inline endpoint-inv__btn-inline--danger"
                        onClick={() => void handleDeleteDevice(d)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="endpoint-inv__section">
        <h2>Подключения к портам сети</h2>
        {attachments.length === 0 && !loading ? (
          <p className="endpoint-inv__muted">
            Нет записей. Кнопка «Подключить к сети» создаёт связь порта
            коммутатора с NIC оконечного устройства.
          </p>
        ) : null}
        {attachments.length > 0 ? (
          <div className="endpoint-inv__table-wrap">
            <table className="endpoint-inv__table">
              <thead>
                <tr>
                  <th>Порт сети</th>
                  <th>NIC оконечного</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attachments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {netIfaceLabel(
                        a.networkInterfaceId,
                        networkDevices,
                        networkInterfaces,
                      )}
                    </td>
                    <td>
                      {epIfaceLabel(
                        a.endpointInterfaceId,
                        endpointDevices,
                        endpointInterfaces,
                      )}
                    </td>
                    <td className="endpoint-inv__td-actions">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

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
