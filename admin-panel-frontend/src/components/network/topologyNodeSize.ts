/** Минимальная ширина центрального блока (hostname, IP, статус). */
const HEAD_MIN_WIDTH = 180

/** Минимальная высота центрального блока. */
const HEAD_MIN_HEIGHT = 72

/** Шаг между портами на верхнем/нижнем ребре (px). */
const HORIZONTAL_PORT_PITCH = 26

/** Шаг между портами на левом/правом ребре (px). */
const VERTICAL_PORT_PITCH = 24

const SIDE_STRIP_WIDTH = 56
const TOP_BOTTOM_STRIP_HEIGHT = 64
const SIDE_STRIP_MIN_HEIGHT = 48
export const TOPOLOGY_NODE_MIN_WIDTH = 200

export type PortEdgeCounts = {
  top: number
  bottom: number
  left: number
  right: number
}

export type TopologyNodeDimensions = {
  width: number
  minHeight: number
  leftStripMinHeight: number
  rightStripMinHeight: number
}

/**
 * Размер узла топологии по числу портов на каждой стороне.
 * Ширина растёт при многих портах сверху/снизу, высота — слева/справа.
 */
export function computeTopologyNodeDimensions(
  counts: PortEdgeCounts,
): TopologyNodeDimensions {
  const { top, bottom, left, right } = counts

  const horizontalPorts = Math.max(top, bottom)
  const horizontalWidth =
    horizontalPorts > 0
      ? Math.max(HEAD_MIN_WIDTH, horizontalPorts * HORIZONTAL_PORT_PITCH + 40)
      : HEAD_MIN_WIDTH

  const hasLeft = left > 0
  const hasRight = right > 0
  const coreWidth =
    HEAD_MIN_WIDTH +
    (hasLeft ? SIDE_STRIP_WIDTH : 0) +
    (hasRight ? SIDE_STRIP_WIDTH : 0)

  const width = Math.max(TOPOLOGY_NODE_MIN_WIDTH, horizontalWidth, coreWidth)

  const leftStripMinHeight = hasLeft
    ? Math.max(SIDE_STRIP_MIN_HEIGHT, left * VERTICAL_PORT_PITCH + 16)
    : SIDE_STRIP_MIN_HEIGHT
  const rightStripMinHeight = hasRight
    ? Math.max(SIDE_STRIP_MIN_HEIGHT, right * VERTICAL_PORT_PITCH + 16)
    : SIDE_STRIP_MIN_HEIGHT

  const midMinHeight = Math.max(
    HEAD_MIN_HEIGHT,
    hasLeft ? leftStripMinHeight : 0,
    hasRight ? rightStripMinHeight : 0,
  )

  const topStrip = top > 0 ? TOP_BOTTOM_STRIP_HEIGHT : 0
  const bottomStrip = bottom > 0 ? TOP_BOTTOM_STRIP_HEIGHT : 0
  const minHeight = topStrip + midMinHeight + bottomStrip

  return { width, minHeight, leftStripMinHeight, rightStripMinHeight }
}
