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
import { loadNetworkTopology } from '../../api/networkClient'
import type { DeviceInterface, Link, NetworkDevice } from '../../types/network'
import { DeviceModal } from './DeviceModal'
import {
  DeviceNode,
  type DeviceFlowNode,
  type DeviceNodeData,
  type PortEdge,
} from './DeviceNode'
import { LinkModal } from './LinkModal'
import { TopologyEdge } from './TopologyEdge'
import './NetworkGraphView.css'

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
  | null

const nodeTypes = { device: DeviceNode }

const edgeTypes = { topology: TopologyEdge }

const LAYOUT_STORAGE_KEY = 'admin-panel-network-device-positions-v1'

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
        if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
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

/**
 * Сторона узла для порта по положению пира на графе.
 * Вертикаль приоритетнее: при |Δy| ≥ |Δx| — верх/низ; иначе — лево/право (пир с того же бока).
 */
function resolvePortEdge(
  ifaceId: string,
  deviceId: string,
  links: Link[],
  ifaceById: Map<string, DeviceInterface>,
  devicePos: Map<string, { x: number; y: number }>,
): PortEdge {
  const link = links.find(
    (l) => l.interfaceAId === ifaceId || l.interfaceBId === ifaceId,
  )
  if (!link) return 'bottom'

  const otherId =
    link.interfaceAId === ifaceId ? link.interfaceBId : link.interfaceAId
  const other = ifaceById.get(otherId)
  if (!other || other.deviceId === deviceId) return 'bottom'

  const posSelf = devicePos.get(deviceId)
  const posPeer = devicePos.get(other.deviceId)
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

function buildGraph(
  devices: NetworkDevice[],
  interfaces: DeviceInterface[],
  links: Link[],
  /** Сохранённые координаты (localStorage + сессия); иначе — сетка слева сверху. */
  devicePositions?: ReadonlyMap<string, { x: number; y: number }>,
): { nodes: DeviceFlowNode[]; edges: Edge[] } {
  const ifaceById = new Map(
    interfaces.map((i) => [i.id, i] as const),
  )
  const busy = new Set<string>()
  for (const l of links) {
    busy.add(l.interfaceAId)
    busy.add(l.interfaceBId)
  }

  const ordered = [...devices].sort((a, b) => a.id.localeCompare(b.id))
  const devicePos = new Map<string, { x: number; y: number }>()
  let unsavedSlot = 0
  for (const d of ordered) {
    if (devicePositions?.has(d.id)) {
      devicePos.set(d.id, devicePositions.get(d.id)!)
    } else {
      devicePos.set(d.id, topLeftStack(unsavedSlot))
      unsavedSlot += 1
    }
  }

  const nodes: DeviceFlowNode[] = devices.map((d) => {
    const pos = devicePos.get(d.id)!
    const devIfaces = interfaces
      .filter((x) => x.deviceId === d.id)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
    const ports = devIfaces.map((iface) => ({
      id: iface.id,
      name: iface.name,
      adminStatus: iface.adminStatus,
      free: !busy.has(iface.id),
      edge: resolvePortEdge(iface.id, d.id, links, ifaceById, devicePos),
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

  type LinkEdgeDraft = {
    link: Link
    a: DeviceInterface
    b: DeviceInterface
  }
  const drafts: LinkEdgeDraft[] = []
  for (const link of links) {
    const a = ifaceById.get(link.interfaceAId)
    const b = ifaceById.get(link.interfaceBId)
    if (!a || !b) continue
    if (a.deviceId === b.deviceId) continue
    drafts.push({ link, a, b })
  }

  /** Несколько линков между одной парой устройств — общий геометрический путь; разводим в TopologyEdge через stepPosition. */
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
  | null

export const NetworkGraphView = memo(function NetworkGraphView() {
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [interfaces, setInterfaces] = useState<DeviceInterface[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>(null)
  const [linkModal, setLinkModal] = useState<LinkModalState>(null)

  const load = useCallback(async (select?: AfterLoadSelection) => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadNetworkTopology()
      setDevices(data.devices)
      setInterfaces(data.interfaces)
      setLinks(data.links)
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

  const built = useMemo(
    () => buildGraph(devices, interfaces, links, layoutPositions),
    [devices, interfaces, links, layoutPositions],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceFlowNode>([])
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
    if (devices.length === 0) return
    const ids = new Set(devices.map((d) => d.id))
    const toSave = new Map<string, { x: number; y: number }>()
    layoutPositions.forEach((pos, id) => {
      if (ids.has(id)) toSave.set(id, pos)
    })
    writeLayoutToStorage(toSave)
  }, [layoutPositions, devices])

  useEffect(() => {
    setNodes((curr) => {
      const posById = new Map(curr.map((n) => [n.id, n.position]))
      return built.nodes.map((bn) => ({
        ...bn,
        position: posById.get(bn.id) ?? bn.position,
      }))
    })
    setEdges(built.edges)
  }, [built, setNodes, setEdges])

  const onNodeDragStop = useCallback(
    (_: MouseEvent, node: Node) => {
      setLayoutPositions((prev) => {
        const next = new Map(prev)
        next.set(node.id, { ...node.position })
        return next
      })
    },
    [],
  )

  const busyInterfaceIds = useMemo(() => {
    const s = new Set<string>()
    for (const l of links) {
      s.add(l.interfaceAId)
      s.add(l.interfaceBId)
    }
    return s
  }, [links])

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return false
      const sh = c.sourceHandle ?? null
      const th = c.targetHandle ?? null
      if (!sh || !th) return false
      if (busyInterfaceIds.has(sh) || busyInterfaceIds.has(th)) return false
      return true
    },
    [busyInterfaceIds],
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
    (_: MouseEvent, node: DeviceFlowNode) => {
      const d = devices.find((x) => x.id === node.id)
      setSelection(d ? { kind: 'device', device: d } : null)
    },
    [devices],
  )

  const onEdgeClick = useCallback(
    (_: MouseEvent, edge: Edge) => {
      const link = links.find((l) => l.id === edge.id)
      if (!link) {
        setSelection(null)
        return
      }
      const ifaceA = interfaces.find((i) => i.id === link.interfaceAId)
      const ifaceB = interfaces.find((i) => i.id === link.interfaceBId)
      if (!ifaceA || !ifaceB) {
        setSelection(null)
        return
      }
      setSelection({ kind: 'link', link, ifaceA, ifaceB })
    },
    [links, interfaces],
  )

  const onPaneClick = useCallback(() => setSelection(null), [])

  const stats = `${devices.length} устр. · ${links.length} линков · ${interfaces.length} портов`

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
          {!error && loading && devices.length === 0 ? (
            <p className="network-graph__empty">Загрузка топологии…</p>
          ) : null}
          {!error && !loading && devices.length === 0 ? (
            <p className="network-graph__empty">
              Нет устройств в модели. Нажмите «Добавить устройство» выше.
            </p>
          ) : null}
          {!error && devices.length > 0 ? (
            <ReactFlow
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
                maskColor="rgba(0,0,0,0.12)"
                className="network-graph__minimap"
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
          {!selection && !loading ? (
            <p className="network-graph__empty">
              Выберите узел или связь на графе.
            </p>
          ) : null}
          <p className="network-graph__hint">
            Устройства можно перетаскивать — координаты запоминаются в браузере
            (localStorage) и восстанавливаются после перезагрузки. Новые
            устройства без сохранённой позиции появляются слева сверху. Сторона
            порта: при большем смещении по вертикали — сверху/снизу к пиру; иначе
            слева/справа, если пир с этого бока. Свободный порт — снизу. У
            каждого порта одна
            точка соединения. Тяните линк от порта к порту на другом узле.
            Анимация: оба порта UP.
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
