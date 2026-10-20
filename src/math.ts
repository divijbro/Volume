export type Shape = 'cube' | 'cuboid' | 'cylinder'
export type Mode = 'explore' | 'fill' | 'challenge' | 'experiment'
export type Unit = 'cm' | 'm'

export interface Dimensions {
  side: number
  length: number
  width: number
  height: number
  radius: number
}

export const defaultDimensions: Dimensions = {
  side: 4,
  length: 5,
  width: 3,
  height: 4,
  radius: 3,
}

export function shapeDimensions(shape: Shape, dimensions: Dimensions) {
  if (shape === 'cube') return [dimensions.side, dimensions.side, dimensions.side]
  if (shape === 'cuboid') return [dimensions.length, dimensions.width, dimensions.height]
  return [dimensions.radius * 2, dimensions.radius * 2, dimensions.height]
}

export function volumeFor(shape: Shape, dimensions: Dimensions) {
  if (shape === 'cube') return dimensions.side ** 3
  if (shape === 'cuboid') return dimensions.length * dimensions.width * dimensions.height
  return Math.PI * dimensions.radius ** 2 * dimensions.height
}

export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)
}

export function formatVolume(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 6 : 2 }).format(value)
}

export function isInteger(value: number) {
  return Math.abs(value - Math.round(value)) < 1e-8
}

export function getUnitCount(shape: Shape, dimensions: Dimensions, unitScale = 1) {
  const [length, width, height] = shapeDimensions(shape, dimensions)
  return [Math.floor(length / unitScale + 1e-8), Math.floor(width / unitScale + 1e-8), Math.floor(height / unitScale + 1e-8)]
}

export const shapeLabels: Record<Shape, string> = {
  cube: 'Cube',
  cuboid: 'Cuboid',
  cylinder: 'Cylinder',
}

export const modeLabels: Record<Mode, string> = {
  explore: 'Explore',
  fill: 'Fill with units',
  challenge: 'Challenge',
  experiment: 'Experiment',
}
