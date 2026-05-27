import { fetchInterfacesForDevice } from '../../api/networkClient'
import type { DeviceInterface, Vlan } from '../../types/network'
import type {
  BatchCriticality,
  ReconfigurationActionType,
  ReconfigurationBatchView,
  ReconfigurationTask,
  ReconfigurationVlanAction,
} from '../../types/reconfiguration'
import type { DraftAction, DraftBatch } from './reconfigDraftTypes'
import { newId } from './reconfigDraftTypes'

const ROLLBACK_TYPE: Record<ReconfigurationActionType, ReconfigurationActionType> = {
  ADD_VLAN: 'DELETE_VLAN',
  DELETE_VLAN: 'ADD_VLAN',
  CREATE_SUBINTERFACE: 'DELETE_SUBINTERFACE',
  DELETE_SUBINTERFACE: 'CREATE_SUBINTERFACE',
  SET_ACCESS: 'SET_TRUNK',
  SET_TRUNK: 'SET_ACCESS',
  EDIT_TRUNK: 'EDIT_TRUNK',
  SWITCH_VLAN: 'SWITCH_VLAN',
}

export function rollbackActionType(
  actionType: ReconfigurationActionType,
): ReconfigurationActionType {
  return ROLLBACK_TYPE[actionType]
}

function numParam(params: Record<string, unknown>, key: string): number | null {
  const v = params[key]
  return typeof v === 'number' ? v : null
}

function strParam(params: Record<string, unknown>, key: string): string {
  const v = params[key]
  return typeof v === 'string' ? v : ''
}

function numArrayParam(params: Record<string, unknown>, key: string): number[] {
  const v = params[key]
  if (!Array.isArray(v)) return []
  return v.filter((x): x is number => typeof x === 'number')
}

function vlanIdFromSwitchState(state: unknown): number | null {
  if (
    state != null &&
    typeof state === 'object' &&
    'vlanId' in state &&
    typeof (state as { vlanId: unknown }).vlanId === 'number'
  ) {
    return (state as { vlanId: number }).vlanId
  }
  return null
}

function accessVlanFromState(state: unknown): number | null {
  if (
    state != null &&
    typeof state === 'object' &&
    'mode' in state &&
    (state as { mode: unknown }).mode === 'ACCESS' &&
    'vlanId' in state &&
    typeof (state as { vlanId: unknown }).vlanId === 'number'
  ) {
    return (state as { vlanId: number }).vlanId
  }
  return null
}

function trunkAllowedFromState(state: unknown): number[] {
  if (
    state != null &&
    typeof state === 'object' &&
    'allowedVlans' in state &&
    Array.isArray((state as { allowedVlans: unknown }).allowedVlans)
  ) {
    return (state as { allowedVlans: unknown[] }).allowedVlans.filter(
      (x): x is number => typeof x === 'number',
    )
  }
  if (
    state != null &&
    typeof state === 'object' &&
    'mode' in state &&
    (state as { mode: unknown }).mode === 'TRUNK' &&
    'allowedVlans' in state &&
    Array.isArray((state as { allowedVlans: unknown }).allowedVlans)
  ) {
    return (state as { allowedVlans: unknown[] }).allowedVlans.filter(
      (x): x is number => typeof x === 'number',
    )
  }
  return []
}

function nativeFromEditTrunkState(state: unknown): number | null {
  if (
    state != null &&
    typeof state === 'object' &&
    'nativeVlanId' in state &&
    typeof (state as { nativeVlanId: unknown }).nativeVlanId === 'number'
  ) {
    return (state as { nativeVlanId: number }).nativeVlanId
  }
  return null
}

function physicalPort(
  ifaces: DeviceInterface[] | undefined,
  portName: string,
): DeviceInterface | undefined {
  if (!ifaces) return undefined
  const p = portName.trim()
  return ifaces.find((i) => i.name === p && i.parentInterfaceId == null)
}

function currentPortBinding(ifaces: DeviceInterface[] | undefined, portName: string) {
  return physicalPort(ifaces, portName)?.vlanBinding ?? null
}

function parseIpCidr(ipAddress: string | null): { ipv4: string; maskBits: string } {
  if (!ipAddress) return { ipv4: '', maskBits: '24' }
  const slash = ipAddress.indexOf('/')
  if (slash < 0) return { ipv4: ipAddress.trim(), maskBits: '24' }
  return {
    ipv4: ipAddress.slice(0, slash).trim(),
    maskBits: ipAddress.slice(slash + 1).trim() || '24',
  }
}

function findSubinterface(
  ifaces: DeviceInterface[] | undefined,
  parentInterface: string,
  vlanId: number,
): DeviceInterface | undefined {
  if (!ifaces) return undefined
  const parent = physicalPort(ifaces, parentInterface)
  if (!parent) return undefined
  return ifaces.find(
    (i) => i.parentInterfaceId === parent.id && i.dot1qVlanId === vlanId,
  )
}

function vlanNameFromCatalog(vlans: Vlan[], vlanId: number): string {
  return vlans.find((v) => v.vlanId === vlanId)?.name ?? ''
}

function draftBase(action: ReconfigurationVlanAction): {
  rowKey: string
  id: string
  deviceId: string
} {
  return {
    rowKey: newId(),
    id: newId(),
    deviceId: action.deviceId,
  }
}

export function buildRollbackDraftAction(
  action: ReconfigurationVlanAction,
  ifacesByDevice: Map<string, DeviceInterface[]>,
  vlans: Vlan[],
): DraftAction {
  const p = action.params ?? {}
  const ifaces = ifacesByDevice.get(action.deviceId)
  const base = draftBase(action)
  const rollbackType = rollbackActionType(action.actionType)

  switch (rollbackType) {
    case 'DELETE_VLAN': {
      const vlanId = numParam(p, 'vlanId')
      return {
        ...base,
        actionType: 'DELETE_VLAN',
        vlanId: vlanId != null ? String(vlanId) : '',
      }
    }
    case 'ADD_VLAN': {
      const vlanId = numParam(p, 'vlanId')
      const fromPrev = vlanIdFromSwitchState(action.previousState)
      const vid = vlanId ?? fromPrev
      return {
        ...base,
        actionType: 'ADD_VLAN',
        vlanId: vid != null ? String(vid) : '',
        name: vid != null ? vlanNameFromCatalog(vlans, vid) : '',
      }
    }
    case 'DELETE_SUBINTERFACE': {
      return {
        ...base,
        actionType: 'DELETE_SUBINTERFACE',
        parentInterface: strParam(p, 'parentInterface'),
        vlanId: String(numParam(p, 'vlanId') ?? ''),
      }
    }
    case 'CREATE_SUBINTERFACE': {
      const parentInterface = strParam(p, 'parentInterface')
      const vlanId = numParam(p, 'vlanId')
      const sub =
        vlanId != null
          ? findSubinterface(ifaces, parentInterface, vlanId)
          : undefined
      const { ipv4, maskBits } = parseIpCidr(sub?.ipAddress ?? null)
      return {
        ...base,
        actionType: 'CREATE_SUBINTERFACE',
        parentInterface,
        vlanId: vlanId != null ? String(vlanId) : '',
        ipv4,
        maskBits,
      }
    }
    case 'SET_TRUNK': {
      const port = strParam(p, 'port')
      const prevTrunk = trunkAllowedFromState(action.previousState)
      const nativeFromPrev = nativeFromEditTrunkState(action.previousState)
      const binding = currentPortBinding(ifaces, port)
      const currentAccess =
        binding?.mode === 'ACCESS' && binding.accessVlanId != null
          ? String(binding.accessVlanId)
          : accessVlanFromState(action.targetState) != null
            ? String(accessVlanFromState(action.targetState))
            : numParam(p, 'vlanId') != null
              ? String(numParam(p, 'vlanId'))
              : ''
      return {
        ...base,
        actionType: 'SET_TRUNK',
        port,
        allowedVlanIds: [...prevTrunk].sort((a, b) => a - b),
        nativeVlanId:
          nativeFromPrev != null
            ? String(nativeFromPrev)
            : binding?.nativeVlanId != null
              ? String(binding.nativeVlanId)
              : '',
        previousAccessVlanId: currentAccess,
      }
    }
    case 'SET_ACCESS': {
      const port = strParam(p, 'port')
      const prevAccess = accessVlanFromState(action.previousState)
      const binding = currentPortBinding(ifaces, port)
      const trunkIds = binding?.trunkAllowedVlanIds ?? []
      return {
        ...base,
        actionType: 'SET_ACCESS',
        port,
        vlanId: prevAccess != null ? String(prevAccess) : '',
        previousAllowedVlanIds:
          binding?.mode === 'TRUNK' && trunkIds.length > 0
            ? [...trunkIds].sort((a, c) => a - c)
            : numArrayParam(p, 'allowedVlans').length > 0
              ? numArrayParam(p, 'allowedVlans')
              : trunkAllowedFromState(action.targetState),
      }
    }
    case 'EDIT_TRUNK': {
      const port = strParam(p, 'port')
      const prevAllowed = trunkAllowedFromState(action.previousState)
      const prevNative = nativeFromEditTrunkState(action.previousState)
      const binding = currentPortBinding(ifaces, port)
      const currentTrunk = binding?.trunkAllowedVlanIds ?? []
      return {
        ...base,
        actionType: 'EDIT_TRUNK',
        port,
        allowedVlanIds: [...prevAllowed].sort((a, c) => a - c),
        nativeVlanId: prevNative != null ? String(prevNative) : '',
        previousAllowedVlanIds:
          binding?.mode === 'TRUNK' && currentTrunk.length > 0
            ? [...currentTrunk].sort((a, c) => a - c)
            : numArrayParam(p, 'allowedVlans'),
        previousNativeVlanId:
          binding?.mode === 'TRUNK' && binding.nativeVlanId != null
            ? String(binding.nativeVlanId)
            : String(nativeFromEditTrunkState(action.targetState) ?? ''),
      }
    }
    case 'SWITCH_VLAN': {
      const port = strParam(p, 'port')
      const prevVlan = vlanIdFromSwitchState(action.previousState)
      const binding = currentPortBinding(ifaces, port)
      const currentVlan =
        binding?.mode === 'ACCESS' && binding.accessVlanId != null
          ? String(binding.accessVlanId)
          : numParam(p, 'targetVlanId') != null
            ? String(numParam(p, 'targetVlanId'))
            : vlanIdFromSwitchState(action.targetState) != null
              ? String(vlanIdFromSwitchState(action.targetState))
              : ''
      return {
        ...base,
        actionType: 'SWITCH_VLAN',
        port,
        targetVlanId: prevVlan != null ? String(prevVlan) : '',
        previousVlanId: currentVlan,
      }
    }
  }
}

function cloneBatchWithActions(
  criticality: BatchCriticality,
  actions: DraftAction[],
): DraftBatch {
  return {
    id: newId(),
    criticality,
    actions,
  }
}

export function buildRollbackBatchesForAction(
  action: ReconfigurationVlanAction,
  ifacesByDevice: Map<string, DeviceInterface[]>,
  vlans: Vlan[],
): DraftBatch[] {
  return [
    cloneBatchWithActions('NORMAL', [
      buildRollbackDraftAction(action, ifacesByDevice, vlans),
    ]),
  ]
}

export function buildRollbackBatchesForBatch(
  batch: ReconfigurationBatchView,
  ifacesByDevice: Map<string, DeviceInterface[]>,
  vlans: Vlan[],
): DraftBatch[] {
  const actions = [...batch.actions]
    .reverse()
    .map((a) => buildRollbackDraftAction(a, ifacesByDevice, vlans))
  return [cloneBatchWithActions(batch.criticality, actions)]
}

export function buildRollbackBatchesForTask(
  task: ReconfigurationTask,
  ifacesByDevice: Map<string, DeviceInterface[]>,
  vlans: Vlan[],
): DraftBatch[] {
  return [...task.batches]
    .reverse()
    .map((batch) => {
      const actions = [...batch.actions]
        .reverse()
        .map((a) => buildRollbackDraftAction(a, ifacesByDevice, vlans))
      return cloneBatchWithActions(batch.criticality, actions)
    })
}

export async function loadInterfacesForActions(
  actions: ReconfigurationVlanAction[],
): Promise<Map<string, DeviceInterface[]>> {
  const deviceIds = [...new Set(actions.map((a) => a.deviceId))]
  const entries = await Promise.all(
    deviceIds.map(async (deviceId) => {
      try {
        const ifaces = await fetchInterfacesForDevice(deviceId)
        return [deviceId, ifaces] as const
      } catch {
        return [deviceId, [] as DeviceInterface[]] as const
      }
    }),
  )
  return new Map(entries)
}

export function collectActionsFromTask(task: ReconfigurationTask): ReconfigurationVlanAction[] {
  return task.batches.flatMap((b) => b.actions)
}

export function isRollbackEligibleStatus(status: string): boolean {
  return status === 'SUCCESS'
}
