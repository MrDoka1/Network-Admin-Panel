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

const base = () => import.meta.env.VITE_API_BASE_URL ?? ''

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchDevices(): Promise<NetworkDevice[]> {
  const res = await fetch(`${base()}/api/v1/network/devices`)
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
  const res = await fetch(`${base()}/api/v1/network/devices`, {
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
  const res = await fetch(`${base()}/api/v1/network/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<NetworkDevice>(res)
}

export async function fetchInterfacesForDevice(
  deviceId: string,
): Promise<DeviceInterface[]> {
  const res = await fetch(
    `${base()}/api/v1/network/devices/${deviceId}/interfaces`,
  )
  return parseJson<DeviceInterface[]>(res)
}

export async function createDeviceInterface(
  deviceId: string,
  payload: DeviceInterfaceCreatePayload,
): Promise<DeviceInterface> {
  const res = await fetch(
    `${base()}/api/v1/network/devices/${deviceId}/interfaces`,
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
  const res = await fetch(`${base()}/api/v1/network/interfaces/${interfaceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<DeviceInterface>(res)
}

export async function deleteDeviceInterface(interfaceId: string): Promise<void> {
  const res = await fetch(`${base()}/api/v1/network/interfaces/${interfaceId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
}

export async function fetchLinks(): Promise<Link[]> {
  const res = await fetch(`${base()}/api/v1/network/links`)
  return parseJson<Link[]>(res)
}

export async function createLink(payload: LinkCreatePayload): Promise<Link> {
  const res = await fetch(`${base()}/api/v1/network/links`, {
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
