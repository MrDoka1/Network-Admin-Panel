import type { DeviceInterfaceVlanBinding } from '../types/network'

/** Краткая подпись для подписи порта на схеме (корень — физ. порт). */
export function rootPortVlanCaption(
  vlanBinding: DeviceInterfaceVlanBinding | null | undefined,
): string | null {
  if (!vlanBinding) return null
  if (vlanBinding.mode === 'ACCESS') {
    return vlanBinding.accessVlanId != null
      ? `A${vlanBinding.accessVlanId}`
      : 'ACCESS'
  }
  const ids = [...(vlanBinding.trunkAllowedVlanIds ?? [])].sort(
    (a, b) => a - b,
  )
  if (ids.length === 0) return 'TRUNK'
  const joined = ids.join(',')
  return joined.length <= 14 ? `T:${joined}` : `T:${ids.length} VLAN`
}

/** Подробный текст для title у порта. */
export function rootPortVlanTooltip(
  vlanBinding: DeviceInterfaceVlanBinding | null | undefined,
): string | null {
  if (!vlanBinding) return null
  if (vlanBinding.mode === 'ACCESS') {
    return `Access VLAN ${vlanBinding.accessVlanId ?? '—'}`
  }
  const ids = [...(vlanBinding.trunkAllowedVlanIds ?? [])].sort(
    (a, b) => a - b,
  )
  const allowed =
    ids.length > 0 ? ids.join(', ') : 'нет записей в списке разрешённых'
  const nat =
    vlanBinding.nativeVlanId != null
      ? `; native VLAN ${vlanBinding.nativeVlanId}`
      : ''
  return `Trunk; разрешённые VLAN: ${allowed}${nat}`
}

export function formatPhysicalL2Summary(
  vlanBinding: DeviceInterfaceVlanBinding | null | undefined,
): string {
  if (!vlanBinding) return '—'
  if (vlanBinding.mode === 'ACCESS') {
    return vlanBinding.accessVlanId != null
      ? `access, VLAN ${vlanBinding.accessVlanId}`
      : 'access'
  }
  const ids = [...(vlanBinding.trunkAllowedVlanIds ?? [])].sort(
    (a, b) => a - b,
  )
  const allowed = ids.length ? ids.join(', ') : '—'
  const nat =
    vlanBinding.nativeVlanId != null
      ? `; native ${vlanBinding.nativeVlanId}`
      : ''
  return `trunk; разреш.: ${allowed}${nat}`
}
