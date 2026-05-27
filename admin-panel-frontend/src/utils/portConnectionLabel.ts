import type {
  EndpointDevice,
  EndpointDeviceInterface,
  EndpointNetworkAttachment,
} from '../types/endpoint'
import type { DeviceInterface, Link, NetworkDevice } from '../types/network'

export type PortConnectionContext = {
  links: Link[]
  allInterfaces: DeviceInterface[]
  devices: NetworkDevice[]
  attachments?: EndpointNetworkAttachment[]
  endpointInterfaces?: EndpointDeviceInterface[]
  endpointDevices?: EndpointDevice[]
}

/** «hostname · имя» для линков и привязок к оконечным устройствам; null — нет соединения. */
export function formatNetworkPortConnections(
  interfaceId: string,
  ctx: PortConnectionContext,
): string | null {
  const ifaceById = new Map(ctx.allInterfaces.map((i) => [i.id, i]))
  const deviceById = new Map(ctx.devices.map((d) => [d.id, d]))
  const epIfaceById = new Map(
    (ctx.endpointInterfaces ?? []).map((i) => [i.id, i]),
  )
  const epDeviceById = new Map(
    (ctx.endpointDevices ?? []).map((d) => [d.id, d]),
  )
  const parts: string[] = []

  for (const link of ctx.links) {
    let otherId: string | null = null
    if (link.interfaceAId === interfaceId) otherId = link.interfaceBId
    else if (link.interfaceBId === interfaceId) otherId = link.interfaceAId
    else continue
    const oi = ifaceById.get(otherId)
    if (!oi) continue
    const od = deviceById.get(oi.deviceId)
    parts.push(`${od?.hostname ?? '?'} · ${oi.name}`)
  }

  for (const att of ctx.attachments ?? []) {
    if (att.networkInterfaceId !== interfaceId) continue
    const ei = epIfaceById.get(att.endpointInterfaceId)
    if (!ei) continue
    const ed = epDeviceById.get(ei.endpointDeviceId)
    parts.push(`${ed?.hostname ?? '?'} · ${ei.name}`)
  }

  return parts.length > 0 ? parts.join('; ') : null
}

/** Подпись колонки «Сосед» / «Соединение» в таблице портов. */
export function portConnectionCellLabel(
  isSubinterface: boolean,
  connections: string | null | undefined,
  hasConnectionContext: boolean,
): string {
  if (isSubinterface) return '—'
  if (connections) return connections
  return hasConnectionContext ? 'свободен' : '—'
}
