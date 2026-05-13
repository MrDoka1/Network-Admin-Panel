import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react'
import {
  fetchEndpointAttachments,
  fetchEndpointDevices,
  fetchEndpointInterfaces,
  loadNetworkTopology,
} from '../../api/networkClient'
import type {
  EndpointDevice,
  EndpointDeviceInterface,
  EndpointNetworkAttachment,
} from '../../types/endpoint'
import type { DeviceInterface, Link, NetworkDevice } from '../../types/network'
import { DeviceModal } from './DeviceModal'
import { VlanModal } from './VlanModal'
import {
  DeviceNode,
  type DeviceFlowNode,
  type DeviceNodeData,
  type PortEdge,
} from './DeviceNode'
import { EndpointNode, type EndpointFlowNode } from './EndpointNode'
import { LinkModal } from './LinkModal'
import { TopologyEdge } from './TopologyEdge'
import './NetworkGraphView.css'

export type AppFlowNode = DeviceFlowNode | EndpointFlowNode

type DeviceModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; device: NetworkDevice }

type LinkModalState =
  | null
  | {
      deviceA: NetworkDevice
      deviceB: NetworkDevice
      presetInterfaceAId?: string
      presetInterfaceBId?: string
    }

type AfterLoadSelection =
  | { kind: 'device'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'endpoint'; id: string }
  | { kind: 'attachment'; id: string }
  | null

const nodeTypes = { device: DeviceNode, endpoint: EndpointNode }

const edgeTypes = { topology: TopologyEdge }

/** Цвета узлов в миниатюре — в одной гамме с карточками на схеме. */
function minimapNodeColor(n: Node): string {
  if (n.type === 'endpoint') {
    return 'rgba(13, 148, 136, 0.92)'
  }
  if (n.type === 'device') {
    const dt = (n.data as DeviceNodeData).deviceType
    if (dt === 'ROUTER') return 'rgba(217, 119, 6, 0.92)'
    if (dt === 'SWITCH') return 'rgba(37, 99, 235, 0.92)'
  }
  return 'rgba(100, 116, 139, 0.7)'
}

const LAYOUT_STORAGE_KEY = 'admin-panel-network-device-positions-v1'
const LAYOUT_STORAGE_KEY_ENDPOINT =
  'admin-panel-endpoint-device-positions-v1'

/** Устройства без записи в localStorage — сетка от левого верхнего угла поля. */
function topLeftStack(index: number): { x: number; y: number } {
  const COLS = 3
  const STRIDE_X = 280
  const STRIDE_Y = 132
  const ORIGIN_X = 16
  const ORIGIN_Y = 16
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: ORIGIN_X + col * STRIDE_X, y: ORIGIN_Y + row * STRIDE_Y }
}

/** Оконечные узлы без позиции — справа от инфраструктурной сетки. */
function endpointRightStack(index: number): { x: number; y: number } {
  const COLS = 2
  const STRIDE_X = 260
  const STRIDE_Y = 140
  const ORIGIN_X = 920
  const ORIGIN_Y = 48
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: ORIGIN_X + col * STRIDE_X, y: ORIGIN_Y + row * STRIDE_Y }
}

function readLayoutFromStorage(): Map<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return new Map()
    const m = new Map<string, { x: number; y: number }>()
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'x' in v && 'y' in v) {
        const x = (v as { x: unknown }).x
        const y = (v as { y: unknown }).y
        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          Number.isFinite(x) &&
          Number.isFinite(y)
        ) {
          m.set(k, { x, y })
        }
      }
    }
    return m
  } catch {
    return new Map()
  }
}

function readEndpointLayoutFromStorage(): Map<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY_ENDPOINT)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return new Map()
    const m = new Map<string, { x: number; y: number }>()
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'x' in v && 'y' in v) {
        const x = (v as { x: unknown }).x
        const y = (v as { y: unknown }).y
        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          Number.isFinite(x) &&
          Number.isFinite(y)
        ) {
          m.set(k, { x, y })
        }
      }
    }
    return m
  } catch {
    return new Map()
  }
}

function writeLayoutToStorage(map: ReadonlyMap<string, { x: number; y: number }>) {
  try {
    const obj: Record<string, { x: number; y: number }> = {}
    map.forEach((v, k) => {
      obj[k] = { x: v.x, y: v.y }
    })
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* quota / private mode */
  }
}

function writeEndpointLayoutToStorage(
  map: ReadonlyMap<string, { x: number; y: number }>,
) {
  try {
    const obj: Record<string, { x: number; y: number }> = {}
    map.forEach((v, k) => {
      obj[k] = { x: v.x, y: v.y }
    })
    localStorage.setItem(LAYOUT_STORAGE_KEY_ENDPOINT, JSON.stringify(obj))
  } catch {
    /* quota */
  }
}

function vectorToPortEdge(
  selfDeviceId: string,
  peerDeviceId: string,
  allPos: Map<string, { x: number; y: number }>,
): PortEdge {
  const posSelf = allPos.get(selfDeviceId)
  const posPeer = allPos.get(peerDeviceId)
  if (!posSelf || !posPeer) return 'bottom'

  const dx = posPeer.x - posSelf.x
  const dy = posPeer.y - posSelf.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)

  if (ady >= adx) {
    if (dy < 0) return 'top'
    if (dy > 0) return 'bottom'
    if (dx > 0) return 'right'
    if (dx < 0) return 'left'
    return 'bottom'
  }

  if (dx > 0) return 'right'
  if (dx < 0) return 'left'
  return 'bottom'
}

function resolveInfraPortEdge(
  ifaceId: string,
  deviceId: string,
  links: Link[],
  attachments: EndpointNetworkAttachment[],
  infraIfaceById: Map<string, DeviceInterface>,
  epIfaceById: Map<string, EndpointDeviceInterface>,
  allPos: Map<string, { x: number; y: number }>,
): PortEdge {
  const link = links.find(
    (l) => l.interfaceAId === ifaceId || l.interfaceBId === ifaceId,
  )
  if (link) {
    const otherId =
      link.interfaceAId === ifaceId ? link.interfaceBId : link.interfaceAId
    const other = infraIfaceById.get(otherId)
    if (other && other.deviceId !== deviceId) {
      return vectorToPortEdge(deviceId, other.deviceId, allPos)
    }
  }
  const att = attachments.find((a) => a.networkInterfaceId === ifaceId)
  if (att) {
    const ep = epIfaceById.get(att.endpointInterfaceId)
    if (ep) {
      return vectorToPortEdge(deviceId, ep.endpointDeviceId, allPos)
    }
  }
  return 'bottom'
}

function resolveEndpointPortEdge(
  ifaceId: string,
  endpointDeviceId: string,
  attachments: EndpointNetworkAttachment[],
  infraIfaceById: Map<string, DeviceInterface>,
  allPos: Map<string, { x: number; y: number }>,
): PortEdge {
  const att = attachments.find((a) => a.endpointInterfaceId === ifaceId)
  if (!att) return 'top'
  const ni = infraIfaceById.get(att.networkInterfaceId)
  if (!ni) return 'top'
  return vectorToPortEdge(endpointDeviceId, ni.deviceId, allPos)
}

function buildGraph(
  devices: NetworkDevice[],
  interfaces: DeviceInterface[],
  links: Link[],
  endpointDevices: EndpointDevice[],
  endpointInterfaces: EndpointDeviceInterface[],
  attachments: EndpointNetworkAttachment[],
  devicePositions?: ReadonlyMap<string, { x: number; y: number }>,
  endpointPositions?: ReadonlyMap<string, { x: number; y: number }>,
): { nodes: AppFlowNode[]; edges: Edge[] } {
  const infraIfaceById = new Map(
    interfaces.map((i) => [i.id, i] as const),
  )
  const epIfaceById = new Map(
    endpointInterfaces.map((i) => [i.id, i] as const),
  )

  const busy = new Set<string>()
  for (const l of links) {
    busy.add(l.interfaceAId)
    busy.add(l.interfaceBId)
  }
  for (const a of attachments) {
    busy.add(a.networkInterfaceId)
  }

  const ordered = [...devices].sort((a, b) => a.id.localeCompare(b.id))
  const devicePos = new Map<string, { x: number; y: number }>()
  let unsavedInfra = 0
  for (const d of ordered) {
    if (devicePositions?.has(d.id)) {
      devicePos.set(d.id, devicePositions.get(d.id)!)
    } else {
      devicePos.set(d.id, topLeftStack(unsavedInfra))
      unsavedInfra += 1
    }
  }

  const orderedEp = [...endpointDevices].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const endpointPos = new Map<string, { x: number; y: number }>()
  let unsavedEp = 0
  for (const d of orderedEp) {
    if (endpointPositions?.has(d.id)) {
      endpointPos.set(d.id, endpointPositions.get(d.id)!)
    } else {
      endpointPos.set(d.id, endpointRightStack(unsavedEp))
      unsavedEp += 1
    }
  }

  const allPos = new Map<string, { x: number; y: number }>([
    ...devicePos,
    ...endpointPos,
  ])

  const infraNodes: DeviceFlowNode[] = devices.map((d) => {
    const pos = devicePos.get(d.id)!
    const devIfaces = interfaces
      .filter((x) => x.deviceId === d.id && !x.parentInterfaceId)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
    const ports = devIfaces.map((iface) => ({
      id: iface.id,
      name: iface.name,
      adminStatus: iface.adminStatus,
      free: !busy.has(iface.id),
      edge: resolveInfraPortEdge(
        iface.id,
        d.id,
        links,
        attachments,
        infraIfaceById,
        epIfaceById,
        allPos,
      ),
    }))
    const data: DeviceNodeData = {
      hostname: d.hostname,
      deviceType: d.deviceType,
      mgmtIp: d.mgmtIp,
      status: d.status,
      ports,
    }
    return {
      id: d.id,
      type: 'device',
      position: pos,
      data,
    }
  })

  const epNodes: EndpointFlowNode[] = endpointDevices.map((d) => {
    const pos = endpointPos.get(d.id)!
    const ifaces = endpointInterfaces
      .filter((x) => x.endpointDeviceId === d.id)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
    const ports = ifaces.map((iface) => ({
      id: iface.id,
      name: iface.name,
      adminStatus: iface.adminStatus,
      free: false,
      edge: resolveEndpointPortEdge(
        iface.id,
        d.id,
        attachments,
        infraIfaceById,
        allPos,
      ),
    }))
    return {
      id: d.id,
      type: 'endpoint',
      position: pos,
      data: {
        hostname: d.hostname,
        status: d.status,
        ports,
      },
    }
  })

  const nodes: AppFlowNode[] = [...infraNodes, ...epNodes]

  type LinkEdgeDraft = {
    link: Link
    a: DeviceInterface
    b: DeviceInterface
  }
  const drafts: LinkEdgeDraft[] = []
  for (const link of links) {
    const a = infraIfaceById.get(link.interfaceAId)
    const b = infraIfaceById.get(link.interfaceBId)
    if (!a || !b) continue
    if (a.deviceId === b.deviceId) continue
    drafts.push({ link, a, b })
  }

  const pairKey = (d1: string, d2: string) =>
    d1 < d2 ? `${d1}|${d2}` : `${d2}|${d1}`
  const draftsByPair = new Map<string, LinkEdgeDraft[]>()
  for (const d of drafts) {
    const k = pairKey(d.a.deviceId, d.b.deviceId)
    let arr = draftsByPair.get(k)
    if (!arr) {
      arr = []
      draftsByPair.set(k, arr)
    }
    arr.push(d)
  }
  for (const arr of draftsByPair.values()) {
    arr.sort((x, y) => x.link.id.localeCompare(y.link.id))
  }

  const edges: Edge[] = []
  for (const { link, a, b } of drafts) {
    const siblings = draftsByPair.get(pairKey(a.deviceId, b.deviceId))!
    const pathFanCount = siblings.length
    const pathFanIndex = siblings.findIndex((x) => x.link.id === link.id)

    edges.push({
      id: link.id,
      source: a.deviceId,
      target: b.deviceId,
      sourceHandle: a.id,
      targetHandle: b.id,
      type: 'topology',
      animated: a.adminStatus === 'UP' && b.adminStatus === 'UP',
      data: { pathFanIndex, pathFanCount },
      style: {
        stroke:
          a.adminStatus === 'UP' && b.adminStatus === 'UP'
            ? 'var(--text-h)'
            : 'var(--text)',
        strokeWidth: 2,
        opacity: 0.85,
      },
    })
  }

  type AttDraft = {
    att: EndpointNetworkAttachment
    ni: DeviceInterface
    ei: EndpointDeviceInterface
  }
  const attDrafts: AttDraft[] = []
  for (const att of attachments) {
    const ni = infraIfaceById.get(att.networkInterfaceId)
    const ei = epIfaceById.get(att.endpointInterfaceId)
    if (!ni || !ei) continue
    attDrafts.push({ att, ni, ei })
  }

  const attByPair = new Map<string, AttDraft[]>()
  for (const d of attDrafts) {
    const k = pairKey(d.ni.deviceId, d.ei.endpointDeviceId)
    let arr = attByPair.get(k)
    if (!arr) {
      arr = []
      attByPair.set(k, arr)
    }
    arr.push(d)
  }
  for (const arr of attByPair.values()) {
    arr.sort((x, y) => x.att.id.localeCompare(y.att.id))
  }

  for (const { att, ni, ei } of attDrafts) {
    const siblings = attByPair.get(pairKey(ni.deviceId, ei.endpointDeviceId))!
    const pathFanCount = siblings.length
    const pathFanIndex = siblings.findIndex((x) => x.att.id === att.id)
    const up = ni.adminStatus === 'UP' && ei.adminStatus === 'UP'

    edges.push({
      id: `att:${att.id}`,
      source: ni.deviceId,
      target: ei.endpointDeviceId,
      sourceHandle: ni.id,
      targetHandle: ei.id,
      type: 'topology',
      animated: up,
      data: { pathFanIndex, pathFanCount },
      style: {
        stroke: up ? '#0d9488' : '#64748b',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        opacity: 0.9,
      },
    })
  }

  return { nodes, edges }
}

type Selection =
  | { kind: 'device'; device: NetworkDevice }
  | {
      kind: 'link'
      link: Link
      ifaceA: DeviceInterface
      ifaceB: DeviceInterface
    }
  | { kind: 'endpoint'; device: EndpointDevice }
  | {
      kind: 'attachment'
      attachment: EndpointNetworkAttachment
      netIface: DeviceInterface
      epIface: EndpointDeviceInterface
    }
  | null

export const NetworkGraphView = memo(function NetworkGraphView() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [interfaces, setInterfaces] = useState<DeviceInterface[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [endpointDevices, setEndpointDevices] = useState<EndpointDevice[]>([])
  const [endpointInterfaces, setEndpointInterfaces] = useState<
    EndpointDeviceInterface[]
  >([])
  const [attachments, setAttachments] = useState<EndpointNetworkAttachment[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>(null)
  const [linkModal, setLinkModal] = useState<LinkModalState>(null)
  const [vlanModalOpen, setVlanModalOpen] = useState(false)

  const load = useCallback(async (select?: AfterLoadSelection) => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadNetworkTopology()
      const [epDevices, epAttachments] = await Promise.all([
        fetchEndpointDevices(),
        fetchEndpointAttachments(),
      ])
      const epIfaceLists = await Promise.all(
        epDevices.map((d) => fetchEndpointInterfaces(d.id)),
      )
      const epIfaces = epIfaceLists.flat()

      setDevices(data.devices)
      setInterfaces(data.interfaces)
      setLinks(data.links)
      setEndpointDevices(epDevices)
      setEndpointInterfaces(epIfaces)
      setAttachments(epAttachments)

      if (select?.kind === 'device') {
        const d = data.devices.find((x) => x.id === select.id)
        setSelection(d ? { kind: 'device', device: d } : null)
      } else if (select?.kind === 'link') {
        const link = data.links.find((l) => l.id === select.id)
        const ifaceA = link
          ? data.interfaces.find((i) => i.id === link.interfaceAId)
          : undefined
        const ifaceB = link
          ? data.interfaces.find((i) => i.id === link.interfaceBId)
          : undefined
        if (link && ifaceA && ifaceB) {
          setSelection({ kind: 'link', link, ifaceA, ifaceB })
        } else {
          setSelection(null)
        }
      } else if (select?.kind === 'endpoint') {
        const d = epDevices.find((x) => x.id === select.id)
        setSelection(d ? { kind: 'endpoint', device: d } : null)
      } else if (select?.kind === 'attachment') {
        const att = epAttachments.find((a) => a.id === select.id)
        const netIface = att
          ? data.interfaces.find((i) => i.id === att.networkInterfaceId)
          : undefined
        const epIface = att
          ? epIfaces.find((i) => i.id === att.endpointInterfaceId)
          : undefined
        if (att && netIface && epIface) {
          setSelection({
            kind: 'attachment',
            attachment: att,
            netIface,
            epIface,
          })
        } else {
          setSelection(null)
        }
      } else {
        setSelection(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const [layoutPositions, setLayoutPositions] = useState<
    Map<string, { x: number; y: number }>
  >(() => readLayoutFromStorage())

  const [endpointLayoutPositions, setEndpointLayoutPositions] = useState<
    Map<string, { x: number; y: number }>
  >(() => readEndpointLayoutFromStorage())

  const built = useMemo(
    () =>
      buildGraph(
        devices,
        interfaces,
        links,
        endpointDevices,
        endpointInterfaces,
        attachments,
        layoutPositions,
        endpointLayoutPositions,
      ),
    [
      devices,
      interfaces,
      links,
      endpointDevices,
      endpointInterfaces,
      attachments,
      layoutPositions,
      endpointLayoutPositions,
    ],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<AppFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    if (devices.length === 0) return
    const ids = new Set(devices.map((d) => d.id))
    setLayoutPositions((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const id of next.keys()) {
        if (!ids.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [devices])

  useEffect(() => {
    setEndpointLayoutPositions((prev) => {
      if (endpointDevices.length === 0) {
        if (loading) return prev
        return prev.size > 0 ? new Map() : prev
      }
      const ids = new Set(endpointDevices.map((d) => d.id))
      let changed = false
      const next = new Map(prev)
      for (const id of next.keys()) {
        if (!ids.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [endpointDevices, loading])

  useEffect(() => {
    if (devices.length === 0) return
    const ids = new Set(devices.map((d) => d.id))
    const toSave = new Map<string, { x: number; y: number }>()
    layoutPositions.forEach((pos, id) => {
      if (ids.has(id)) toSave.set(id, pos)
    })
    writeLayoutToStorage(toSave)
  }, [layoutPositions, devices])

  useEffect(() => {
    if (loading) return
    if (endpointDevices.length === 0) {
      writeEndpointLayoutToStorage(new Map())
      return
    }
    const ids = new Set(endpointDevices.map((d) => d.id))
    const toSave = new Map<string, { x: number; y: number }>()
    endpointLayoutPositions.forEach((pos, id) => {
      if (ids.has(id)) toSave.set(id, pos)
    })
    writeEndpointLayoutToStorage(toSave)
  }, [endpointLayoutPositions, endpointDevices, loading])

  useEffect(() => {
    if (devices.length === 0 && endpointDevices.length === 0) return
    setNodes((curr) => {
      const posById = new Map(curr.map((n) => [n.id, n.position]))
      return built.nodes.map((bn) => ({
        ...bn,
        position: posById.get(bn.id) ?? bn.position,
      }))
    })
    setEdges(built.edges)
  }, [built, setNodes, setEdges, devices.length, endpointDevices.length])

  const onNodeDragStop = useCallback(
    (_: MouseEvent, node: Node) => {
      if (node.type === 'endpoint') {
        setEndpointLayoutPositions((prev) => {
          const next = new Map(prev)
          next.set(node.id, { ...node.position })
          return next
        })
      } else {
        setLayoutPositions((prev) => {
          const next = new Map(prev)
          next.set(node.id, { ...node.position })
          return next
        })
      }
    },
    [],
  )

  const busyInterfaceIds = useMemo(() => {
    const s = new Set<string>()
    for (const l of links) {
      s.add(l.interfaceAId)
      s.add(l.interfaceBId)
    }
    for (const a of attachments) {
      s.add(a.networkInterfaceId)
    }
    return s
  }, [links, attachments])

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return false
      const srcInfra = devices.some((d) => d.id === c.source)
      const tgtInfra = devices.some((d) => d.id === c.target)
      if (!srcInfra || !tgtInfra) return false
      const sh = c.sourceHandle ?? null
      const th = c.targetHandle ?? null
      if (!sh || !th) return false
      if (busyInterfaceIds.has(sh) || busyInterfaceIds.has(th)) return false
      return true
    },
    [busyInterfaceIds, devices],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection
      if (!source || !target || source === target) return
      const da = devices.find((d) => d.id === source)
      const db = devices.find((d) => d.id === target)
      if (!da || !db) return
      const presetA = sourceHandle ?? undefined
      const presetB = targetHandle ?? undefined
      setLinkModal({
        deviceA: da,
        deviceB: db,
        presetInterfaceAId: presetA,
        presetInterfaceBId: presetB,
      })
    },
    [devices],
  )

  const onNodeClick = useCallback(
    (_: MouseEvent, node: AppFlowNode) => {
      if (node.type === 'endpoint') {
        const d = endpointDevices.find((x) => x.id === node.id)
        setSelection(d ? { kind: 'endpoint', device: d } : null)
        return
      }
      const d = devices.find((x) => x.id === node.id)
      setSelection(d ? { kind: 'device', device: d } : null)
    },
    [devices, endpointDevices],
  )

  const onEdgeClick = useCallback(
    (_: MouseEvent, edge: Edge) => {
      const link = links.find((l) => l.id === edge.id)
      if (link) {
        const ifaceA = interfaces.find((i) => i.id === link.interfaceAId)
        const ifaceB = interfaces.find((i) => i.id === link.interfaceBId)
        if (!ifaceA || !ifaceB) {
          setSelection(null)
          return
        }
        setSelection({ kind: 'link', link, ifaceA, ifaceB })
        return
      }
      const attPrefix = 'att:'
      if (edge.id.startsWith(attPrefix)) {
        const attId = edge.id.slice(attPrefix.length)
        const attachment = attachments.find((a) => a.id === attId)
        const netIface = attachment
          ? interfaces.find((i) => i.id === attachment.networkInterfaceId)
          : undefined
        const epIface = attachment
          ? endpointInterfaces.find((i) => i.id === attachment.endpointInterfaceId)
          : undefined
        if (attachment && netIface && epIface) {
          setSelection({ kind: 'attachment', attachment, netIface, epIface })
        } else {
          setSelection(null)
        }
        return
      }
      setSelection(null)
    },
    [links, interfaces, attachments, endpointInterfaces],
  )

  const onPaneClick = useCallback(() => setSelection(null), [])

  const hasGraph = devices.length > 0 || endpointDevices.length > 0

  const routerCount = useMemo(
    () => devices.filter((d) => d.deviceType === 'ROUTER').length,
    [devices],
  )
  const switchCount = useMemo(
    () => devices.filter((d) => d.deviceType === 'SWITCH').length,
    [devices],
  )

  const stats = `${routerCount} маршр. · ${switchCount} коммут. · ${endpointDevices.length} оконеч. · ${links.length} линков · ${attachments.length} к хостам · ${interfaces.length + endpointInterfaces.length} портов`

  return (
    <div className="network-graph">
      <header className="network-graph__header">
        <h1>Топология сети</h1>
        <span className="network-graph__stats">{stats}</span>
        <div className="network-graph__actions">
          <button
            type="button"
            className="network-graph__btn network-graph__btn--primary"
            onClick={() => setDeviceModal({ mode: 'create' })}
          >
            Добавить устройство
          </button>
          <button
            type="button"
            className="network-graph__btn"
            onClick={() => setVlanModalOpen(true)}
          >
            Добавить VLAN
          </button>
          <button
            type="button"
            className="network-graph__btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
      </header>

      <div className="network-graph__main">
        <div className="network-graph__canvas">
          {error ? (
            <p className="network-graph__error" role="alert">
              {error}
            </p>
          ) : null}
          {!error && loading && !hasGraph ? (
            <p className="network-graph__empty">Загрузка топологии…</p>
          ) : null}
          {!error && !loading && !hasGraph ? (
            <p className="network-graph__empty">
              Нет узлов в модели. Добавьте сетевое устройство или оконечный хост
              во вкладке «Оконечные устройства».
            </p>
          ) : null}
          {!error && hasGraph ? (
            <ReactFlow
              colorMode="system"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={1.5}
              onNodeClick={onNodeClick}
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeStrokeWidth={3}
                className="network-graph__minimap"
                nodeColor={minimapNodeColor}
              />
            </ReactFlow>
          ) : null}
        </div>

        <aside className="network-graph__aside" aria-live="polite">
          <h2>Детали</h2>
          {selection?.kind === 'device' ? (
            <>
              <dl>
                <dt>Устройство</dt>
                <dd>{selection.device.hostname}</dd>
                <dt>Тип</dt>
                <dd>{selection.device.deviceType}</dd>
                <dt>Управление (IP)</dt>
                <dd>{selection.device.mgmtIp}</dd>
                <dt>Статус</dt>
                <dd>{selection.device.status}</dd>
                <dt>ID</dt>
                <dd>{selection.device.id}</dd>
              </dl>
              <div className="network-graph__aside-actions">
                <button
                  type="button"
                  className="network-graph__btn network-graph__btn--primary network-graph__btn--block"
                  onClick={() =>
                    setDeviceModal({ mode: 'edit', device: selection.device })
                  }
                >
                  Редактировать
                </button>
              </div>
            </>
          ) : null}
          {selection?.kind === 'endpoint' ? (
            <dl>
              <dt>Оконечное устройство</dt>
              <dd>{selection.device.hostname}</dd>
              <dt>Статус</dt>
              <dd>{selection.device.status}</dd>
              <dt>ID</dt>
              <dd>{selection.device.id}</dd>
            </dl>
          ) : null}
          {selection?.kind === 'link' ? (
            <dl>
              <dt>Линк</dt>
              <dd>{selection.link.id}</dd>
              <dt>Интерфейс A</dt>
              <dd>
                {selection.ifaceA.name} ({selection.ifaceA.adminStatus})
              </dd>
              <dt>Интерфейс B</dt>
              <dd>
                {selection.ifaceB.name} ({selection.ifaceB.adminStatus})
              </dd>
            </dl>
          ) : null}
          {selection?.kind === 'attachment' ? (
            <dl>
              <dt>Подключение к хосту</dt>
              <dd>{selection.attachment.id}</dd>
              <dt>Порт сети</dt>
              <dd>
                {selection.netIface.name} ({selection.netIface.adminStatus})
              </dd>
              <dt>NIC хоста</dt>
              <dd>
                {selection.epIface.name} — {selection.epIface.macAddress} (
                {selection.epIface.adminStatus})
              </dd>
            </dl>
          ) : null}
          {!selection && !loading ? (
            <p className="network-graph__empty">
              Выберите узел или связь на графе.
            </p>
          ) : null}
          <p className="network-graph__hint">
            Позиции инфраструктурных узлов и оконечных устройств сохраняются
            отдельно в localStorage (
            <code className="network-graph__code">{LAYOUT_STORAGE_KEY}</code>,{' '}
            <code className="network-graph__code">
              {LAYOUT_STORAGE_KEY_ENDPOINT}
            </code>
            ). Линки между коммутаторами — сплошная линия; к оконечному узлу —
            пунктир. Новые оконечные узлы без координат появляются справа.
            Перетаскивание линка между узлами только для инфраструктуры.
          </p>
        </aside>
      </div>

      {deviceModal ? (
        <DeviceModal
          mode={deviceModal.mode}
          device={deviceModal.mode === 'edit' ? deviceModal.device : null}
          open
          linkContext={{
            links,
            allInterfaces: interfaces,
            devices,
          }}
          onClose={() => setDeviceModal(null)}
          onPortsChanged={() => {
            if (deviceModal.mode === 'edit') {
              void load({ kind: 'device', id: deviceModal.device.id })
            }
          }}
          onSaved={(saved) => {
            setDeviceModal(null)
            void load({ kind: 'device', id: saved.id })
          }}
        />
      ) : null}
      {vlanModalOpen ? (
        <VlanModal
          open
          onClose={() => setVlanModalOpen(false)}
        />
      ) : null}
      {linkModal ? (
        <LinkModal
          open
          deviceA={linkModal.deviceA}
          deviceB={linkModal.deviceB}
          presetInterfaceAId={linkModal.presetInterfaceAId}
          presetInterfaceBId={linkModal.presetInterfaceBId}
          interfacesA={interfaces.filter(
            (i) => i.deviceId === linkModal.deviceA.id,
          )}
          interfacesB={interfaces.filter(
            (i) => i.deviceId === linkModal.deviceB.id,
          )}
          busyInterfaceIds={busyInterfaceIds}
          onTopologyChanged={() => void load()}
          onClose={() => setLinkModal(null)}
          onCreated={(created) => {
            setLinkModal(null)
            void load({ kind: 'link', id: created.id })
          }}
        />
      ) : null}
    </div>
  )
})
