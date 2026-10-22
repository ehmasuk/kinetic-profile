import * as THREE from "three"

export const MAP_SCALE = 3

export function createIslandShape(scale: number): THREE.Shape {
  const s = scale
  const shape = new THREE.Shape()

  shape.moveTo(-19 * s, -22 * s)
  shape.bezierCurveTo(-25 * s, -17 * s, -25 * s, -8 * s, -23 * s, -2 * s)
  shape.bezierCurveTo(-27 * s, 7 * s, -21 * s, 17 * s, -15 * s, 21 * s)
  shape.bezierCurveTo(-7 * s, 27 * s, 5 * s, 25 * s, 12 * s, 22 * s)
  shape.bezierCurveTo(22 * s, 18 * s, 25 * s, 9 * s, 23 * s, 1 * s)
  shape.bezierCurveTo(28 * s, -8 * s, 23 * s, -17 * s, 15 * s, -22 * s)
  shape.bezierCurveTo(5 * s, -27 * s, -9 * s, -26 * s, -19 * s, -22 * s)

  return shape
}
