export type DeviceType = 'ROUTER' | 'SWITCH'
export type NetworkDeviceStatus = 'ACTIVE' | 'INACTIVE'

export type NetworkDevice = {
  id: string
  deviceType: DeviceType
  hostname: string
  mgmtIp: string
  status: NetworkDeviceStatus
}

/** POST /api/v1/network/devices — поле status опционально, бэкенд по умолчанию ACTIVE */
export type NetworkDeviceCreatePayload = {
  deviceType: DeviceType
  hostname: string
  mgmtIp: string
  status?: NetworkDeviceStatus
}

export type NetworkDeviceUpdatePayload = {
  deviceType: DeviceType
  hostname: string
  mgmtIp: string
  status: NetworkDeviceStatus
}

export type DeviceInterface = {
  id: string
  deviceId: string
  name: string
  adminStatus: 'UP' | 'DOWN'
}

/** POST /api/v1/network/devices/{deviceId}/interfaces */
export type DeviceInterfaceCreatePayload = {
  name: string
  adminStatus: 'UP' | 'DOWN'
}

/** PUT /api/v1/network/interfaces/{id} */
export type DeviceInterfaceUpdatePayload = {
  name: string
  adminStatus: 'UP' | 'DOWN'
}

export type Link = {
  id: string
  interfaceAId: string
  interfaceBId: string
}

/** POST /api/v1/network/links */
export type LinkCreatePayload = {
  interfaceAId: string
  interfaceBId: string
}
