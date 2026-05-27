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

export type VlanAdminStatus = 'ACTIVE' | 'SUSPENDED'
export type VlanOperStatus = 'UP' | 'DOWN' | 'UNKNOWN'

export type Vlan = {
  vlanId: number
  name: string
  adminStatus: string
  operStatus: string | null
  isProtected: boolean
}

/** POST /api/v1/network/vlans — adminStatus по умолчанию ACTIVE, operStatus можно не задавать */
export type VlanCreatePayload = {
  vlanId: number
  name?: string
  adminStatus?: VlanAdminStatus
  operStatus?: VlanOperStatus | null
  isProtected?: boolean
}

/** PATCH /api/v1/network/vlans/{vlanId} */
export type VlanUpdatePayload = {
  name?: string
  adminStatus?: VlanAdminStatus
  operStatus?: VlanOperStatus | null
  isProtected?: boolean
}

/** GET /api/v1/network/device-vlans — VLAN, настроенные на устройстве */
export type DeviceVlan = {
  deviceId: string
  vlanId: number
  name: string | null
  adminStatus: VlanAdminStatus
  operStatus: VlanOperStatus | null
}

export type InterfaceVlanMode = 'ACCESS' | 'TRUNK'

/** Данные из `interface_vlan` + `trunk_allowed_vlan` (см. GET …/devices/{id}/interfaces). */
export type DeviceInterfaceVlanBinding = {
  mode: InterfaceVlanMode
  accessVlanId: number | null
  nativeVlanId: number | null
  trunkAllowedVlanIds?: number[] | null
}

export type DeviceInterface = {
  id: string
  deviceId: string
  name: string
  adminStatus: 'UP' | 'DOWN'
  parentInterfaceId: string | null
  dot1qVlanId: number | null
  ipAddress: string | null
  vlanBinding?: DeviceInterfaceVlanBinding | null
}

/** POST /api/v1/network/devices/{deviceId}/interfaces */
export type DeviceInterfaceCreatePayload = {
  /** Для сабинтерфейса можно не передавать — имя parent.vlanId создаётся на сервере */
  name?: string
  adminStatus: 'UP' | 'DOWN'
  /** null / не передавать — физический порт; иначе UUID родительского порта на этом же устройстве */
  parentInterfaceId?: string | null
  /** Обязателен вместе с parentInterfaceId */
  dot1qVlanId?: number | null
  ipAddress?: string | null
}

/** PUT /api/v1/network/interfaces/{id} */
export type DeviceInterfaceUpdatePayload = {
  name: string
  adminStatus: 'UP' | 'DOWN'
  /** null для физического порта */
  dot1qVlanId?: number | null
  ipAddress?: string | null
}

/** PUT /api/v1/network/interfaces/{interfaceId}/vlan */
export type InterfaceVlanUpsertPayload = {
  mode: InterfaceVlanMode
  accessVlanId?: number | null
  nativeVlanId?: number | null
}

export type TrunkAllowedVlanEntry = {
  interfaceId: string
  vlanId: number
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
