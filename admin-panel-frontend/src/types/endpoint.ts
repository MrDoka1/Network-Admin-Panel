import type { NetworkDeviceStatus } from './network'

export type EndpointDevice = {
  id: string
  hostname: string
  status: NetworkDeviceStatus
}

export type EndpointDeviceInterface = {
  id: string
  endpointDeviceId: string
  name: string
  macAddress: string
  adminStatus: 'UP' | 'DOWN'
  networkInterfaceId: string | null
}

export type EndpointNetworkAttachment = {
  id: string
  networkInterfaceId: string
  endpointInterfaceId: string
}

export type EndpointDeviceCreatePayload = {
  hostname: string
  status?: NetworkDeviceStatus
}

export type EndpointDeviceUpdatePayload = {
  hostname: string
  status: NetworkDeviceStatus
}

export type EndpointDeviceInterfaceCreatePayload = {
  name: string
  macAddress: string
  adminStatus: 'UP' | 'DOWN'
}

export type EndpointDeviceInterfaceUpdatePayload =
  EndpointDeviceInterfaceCreatePayload

export type EndpointNetworkAttachmentCreatePayload = {
  networkInterfaceId: string
  endpointInterfaceId: string
}

export type EndpointNetworkAttachmentUpdatePayload =
  EndpointNetworkAttachmentCreatePayload
