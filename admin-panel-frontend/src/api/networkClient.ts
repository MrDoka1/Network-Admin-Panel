import type {
  EndpointDevice,
  EndpointDeviceCreatePayload,
  EndpointDeviceInterface,
  EndpointDeviceInterfaceCreatePayload,
  EndpointDeviceInterfaceUpdatePayload,
  EndpointDeviceUpdatePayload,
  EndpointNetworkAttachment,
  EndpointNetworkAttachmentCreatePayload,
  EndpointNetworkAttachmentUpdatePayload,
} from '../types/endpoint'
import type {
  DeviceInterface,
  DeviceInterfaceCreatePayload,
  DeviceInterfaceUpdatePayload,
  Link,
  LinkCreatePayload,
  NetworkDevice,
  NetworkDeviceCreatePayload,
  NetworkDeviceUpdatePayload,
} from '../types/network'

import { apiFetch } from './http'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchDevices(): Promise<NetworkDevice[]> {
  const res = await apiFetch(`/api/v1/network/devices`)
  return parseJson<NetworkDevice[]>(res)
}

export async function createDevice(
  payload: NetworkDeviceCreatePayload,
): Promise<NetworkDevice> {
  const body: Record<string, unknown> = {
    deviceType: payload.deviceType,
    hostname: payload.hostname,
    mgmtIp: payload.mgmtIp,
  }
  if (payload.status !== undefined) body.status = payload.status
  const res = await apiFetch(`/api/v1/network/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<NetworkDevice>(res)
}

export async function updateDevice(
  id: string,
  payload: NetworkDeviceUpdatePayload,
): Promise<NetworkDevice> {
  const res = await apiFetch(`/api/v1/network/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<NetworkDevice>(res)
}

export async function fetchInterfacesForDevice(
  deviceId: string,
): Promise<DeviceInterface[]> {
  const res = await apiFetch(
    `/api/v1/network/devices/${deviceId}/interfaces`,
  )
  return parseJson<DeviceInterface[]>(res)
}

export async function createDeviceInterface(
  deviceId: string,
  payload: DeviceInterfaceCreatePayload,
): Promise<DeviceInterface> {
  const res = await apiFetch(
    `/api/v1/network/devices/${deviceId}/interfaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return parseJson<DeviceInterface>(res)
}

export async function updateDeviceInterface(
  interfaceId: string,
  payload: DeviceInterfaceUpdatePayload,
): Promise<DeviceInterface> {
  const res = await apiFetch(`/api/v1/network/interfaces/${interfaceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<DeviceInterface>(res)
}

export async function deleteDeviceInterface(interfaceId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/network/interfaces/${interfaceId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function fetchLinks(): Promise<Link[]> {
  const res = await apiFetch(`/api/v1/network/links`)
  return parseJson<Link[]>(res)
}

export async function createLink(payload: LinkCreatePayload): Promise<Link> {
  const res = await apiFetch(`/api/v1/network/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<Link>(res)
}

export async function loadNetworkTopology(): Promise<{
  devices: NetworkDevice[]
  interfaces: DeviceInterface[]
  links: Link[]
}> {
  const devices = await fetchDevices()
  const interfaceLists = await Promise.all(
    devices.map((d) => fetchInterfacesForDevice(d.id)),
  )
  const interfaces = interfaceLists.flat()
  const links = await fetchLinks()
  return { devices, interfaces, links }
}

/* —— Оконечные устройства —— */

export async function fetchEndpointDevices(): Promise<EndpointDevice[]> {
  const res = await apiFetch(`/api/v1/network/endpoint-devices`)
  return parseJson<EndpointDevice[]>(res)
}

export async function createEndpointDevice(
  payload: EndpointDeviceCreatePayload,
): Promise<EndpointDevice> {
  const body: Record<string, unknown> = { hostname: payload.hostname }
  if (payload.status !== undefined) body.status = payload.status
  const res = await apiFetch(`/api/v1/network/endpoint-devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<EndpointDevice>(res)
}

export async function updateEndpointDevice(
  id: string,
  payload: EndpointDeviceUpdatePayload,
): Promise<EndpointDevice> {
  const res = await apiFetch(`/api/v1/network/endpoint-devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<EndpointDevice>(res)
}

export async function deleteEndpointDevice(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/network/endpoint-devices/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function fetchEndpointInterfaces(
  endpointDeviceId: string,
): Promise<EndpointDeviceInterface[]> {
  const res = await apiFetch(
    `/api/v1/network/endpoint-devices/${endpointDeviceId}/interfaces`,
  )
  return parseJson<EndpointDeviceInterface[]>(res)
}

export async function createEndpointInterface(
  endpointDeviceId: string,
  payload: EndpointDeviceInterfaceCreatePayload,
): Promise<EndpointDeviceInterface> {
  const res = await apiFetch(
    `/api/v1/network/endpoint-devices/${endpointDeviceId}/interfaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return parseJson<EndpointDeviceInterface>(res)
}

export async function updateEndpointInterface(
  interfaceId: string,
  payload: EndpointDeviceInterfaceUpdatePayload,
): Promise<EndpointDeviceInterface> {
  const res = await apiFetch(
    `/api/v1/network/endpoint-interfaces/${interfaceId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return parseJson<EndpointDeviceInterface>(res)
}

export async function deleteEndpointInterface(interfaceId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/network/endpoint-interfaces/${interfaceId}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function fetchEndpointAttachments(): Promise<
  EndpointNetworkAttachment[]
> {
  const res = await apiFetch(`/api/v1/network/endpoint-attachments`)
  return parseJson<EndpointNetworkAttachment[]>(res)
}

export async function createEndpointAttachment(
  payload: EndpointNetworkAttachmentCreatePayload,
): Promise<EndpointNetworkAttachment> {
  const res = await apiFetch(`/api/v1/network/endpoint-attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<EndpointNetworkAttachment>(res)
}

export async function updateEndpointAttachment(
  id: string,
  payload: EndpointNetworkAttachmentUpdatePayload,
): Promise<EndpointNetworkAttachment> {
  const res = await apiFetch(`/api/v1/network/endpoint-attachments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<EndpointNetworkAttachment>(res)
}

export async function deleteEndpointAttachment(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/network/endpoint-attachments/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function loadEndpointInventory(): Promise<{
  endpointDevices: EndpointDevice[]
  endpointInterfaces: EndpointDeviceInterface[]
  attachments: EndpointNetworkAttachment[]
  networkDevices: NetworkDevice[]
  networkInterfaces: DeviceInterface[]
  links: Link[]
}> {
  const [endpointDevices, attachments, networkDevices, links] =
    await Promise.all([
      fetchEndpointDevices(),
      fetchEndpointAttachments(),
      fetchDevices(),
      fetchLinks(),
    ])
  const endpointInterfaceLists = await Promise.all(
    endpointDevices.map((d) => fetchEndpointInterfaces(d.id)),
  )
  const endpointInterfaces = endpointInterfaceLists.flat()
  const networkInterfaceLists = await Promise.all(
    networkDevices.map((d) => fetchInterfacesForDevice(d.id)),
  )
  const networkInterfaces = networkInterfaceLists.flat()
  return {
    endpointDevices,
    endpointInterfaces,
    attachments,
    networkDevices,
    networkInterfaces,
    links,
  }
}
