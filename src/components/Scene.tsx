import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Dimensions, Shape } from '../math'
import { formatNumber, getUnitCount } from '../math'

interface SceneProps {
  shape: Shape
  dimensions: Dimensions
  fill: boolean
  showUnitCubes: boolean
  cubeCount: number
  showGrid: boolean
  showAxes: boolean
  cylinderApproximation: boolean
  resetCameraKey: number
  unitScale: number
  unit: string
}

function Measure({
  start,
  end,
  label,
  color = '#66809c',
}: {
  start: [number, number, number]
  end: [number, number, number]
  label: string
  color?: string
}) {
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1.2} />
      <mesh position={start}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html position={mid} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
        <span className="dimension-tag">{label}</span>
      </Html>
    </group>
  )
}

function SolidShape({ shape, dimensions, fill, showUnitCubes, cubeCount, cylinderApproximation, unitScale, unit }: Pick<SceneProps, 'shape' | 'dimensions' | 'fill' | 'showUnitCubes' | 'cubeCount' | 'cylinderApproximation' | 'unitScale' | 'unit'>) {
  const { side, length, width, height, radius } = dimensions
  const a = shape === 'cube' ? side : length
  const b = shape === 'cube' ? side : width
  const h = shape === 'cube' ? side : height
  const unitFill = fill && showUnitCubes
  const centerY = h / 2
  const outline = '#6485ad'

  if (shape === 'cylinder') {
    return (
      <group>
        <mesh position={[0, centerY, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius, radius, height, 64, 1]} />
          <meshStandardMaterial color="#8eb6f5" roughness={0.56} metalness={0.02} transparent={cylinderApproximation} opacity={cylinderApproximation ? 0.3 : 1} />
          <Edges color={outline} threshold={18} />
        </mesh>
        {cylinderApproximation && <CylinderGrid radius={radius} y={height + 0.018} unitScale={unitScale} />}
        <Measure start={[radius + 0.45, 0, 0]} end={[radius + 0.45, height, 0]} label={`${formatNumber(height / unitScale)} ${unit}`} />
        <Measure start={[0, 0.04, 0]} end={[radius, 0.04, 0]} label={`r = ${formatNumber(radius / unitScale)} ${unit}`} color="#c5813e" />
      </group>
    )
  }

  const [unitsX, unitsZ, unitsY] = getUnitCount(shape, dimensions, unitScale)
  const boxCenter: [number, number, number] = [0, centerY, 0]
  return (
    <group>
      <mesh position={boxCenter} castShadow receiveShadow>
        <boxGeometry args={[a, h, b]} />
        <meshStandardMaterial color="#7eabef" roughness={0.55} visible={!unitFill} />
        <Edges color={outline} threshold={18} />
      </mesh>
      {unitFill && <UnitCubeGrid dimensions={[a, b, h]} cubeCount={cubeCount} unitScale={unitScale} />}
      <Measure start={[-a / 2, -0.05, b / 2 + 0.22]} end={[a / 2, -0.05, b / 2 + 0.22]} label={`${formatNumber(a / unitScale)} ${unit}`} />
      <Measure start={[a / 2 + 0.22, 0, b / 2]} end={[a / 2 + 0.22, h, b / 2]} label={`${formatNumber(h / unitScale)} ${unit}`} />
      <Measure start={[-a / 2 - 0.22, 0, -b / 2]} end={[-a / 2 - 0.22, 0, b / 2]} label={`${formatNumber(b / unitScale)} ${unit}`} />
      {fill && !showUnitCubes && <Html position={[0, h + 0.6, 0]} center distanceFactor={12}><span className="scene-note">{unitsX} × {unitsZ} × {unitsY} unit cubes</span></Html>}
    </group>
  )
}

function UnitCubeGrid({ dimensions, cubeCount, unitScale }: { dimensions: [number, number, number]; cubeCount: number; unitScale: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const previousLayers = useRef<number | null>(null)
  const previousFootprint = useRef<[number, number, number] | null>(null)
  const animation = useRef<{ startLayer: number; endLayer: number; adding: boolean; finalCount: number; startTime: number | null; step: number } | null>(null)
  const [length, width, height] = dimensions
  const nx = Math.floor(length / unitScale + 1e-8)
  const nz = Math.floor(width / unitScale + 1e-8)
  const ny = Math.floor(height / unitScale + 1e-8)
  const layerSize = nx * nz
  const capacity = nx * nz * Math.max(ny, previousLayers.current ?? ny)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])

  function setCubeMatrix(index: number, cubeScale = 1, yOffset = 0) {
    if (!ref.current || nx === 0 || nz === 0) return
    const y = Math.floor(index / layerSize)
    const withinLayer = index % layerSize
    const z = nz - 1 - Math.floor(withinLayer / nx)
    const x = withinLayer % nx
    position.set(
      -length / 2 + x * unitScale + unitScale / 2,
      y * unitScale + unitScale / 2 + yOffset,
      -width / 2 + z * unitScale + unitScale / 2,
    )
    scale.setScalar(cubeScale)
    matrix.compose(position, quaternion, scale)
    ref.current.setMatrixAt(index, matrix)
  }

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const footprint: [number, number, number] = [length, width, unitScale]
    const oldFootprint = previousFootprint.current
    const footprintChanged = !oldFootprint || footprint.some((value, index) => value !== oldFootprint[index])
    const targetLayers = Math.max(0, Math.min(ny, Math.floor(cubeCount / Math.max(1, layerSize))))
    const targetCount = Math.min(capacity, targetLayers * layerSize)
    const previous = previousLayers.current
    const adding = previous !== null && targetLayers > previous

    if (footprintChanged || previous === null) {
      for (let index = 0; index < targetCount; index += 1) setCubeMatrix(index)
      mesh.count = targetCount
      animation.current = null
    } else if (targetLayers !== previous) {
      const startLayer = Math.min(previous, targetLayers)
      const endLayer = Math.max(previous, targetLayers)
      const startIndex = startLayer * layerSize
      const endIndex = endLayer * layerSize
      for (let index = 0; index < startIndex; index += 1) setCubeMatrix(index)
      if (adding) {
        for (let index = startIndex; index < endIndex; index += 1) setCubeMatrix(index, 0.16, unitScale * 0.85)
      } else {
        for (let index = startIndex; index < endIndex; index += 1) setCubeMatrix(index)
      }
      animation.current = { startLayer, endLayer, adding, finalCount: targetCount, startTime: null, step: 0 }
      mesh.count = adding ? targetCount : previous * layerSize
    } else {
      mesh.count = targetCount
      animation.current = null
    }
    previousFootprint.current = footprint
    previousLayers.current = targetLayers
    mesh.instanceMatrix.needsUpdate = true
  }, [cubeCount, capacity, length, width, height, nx, nz, unitScale, layerSize])

  useFrame(({ clock }) => {
    const active = animation.current
    const mesh = ref.current
    if (!active || !mesh) return
    if (active.startTime === null) active.startTime = clock.elapsedTime
    const durationPerLayer = 0.36
    const elapsed = Math.max(0, clock.elapsedTime - active.startTime)
    const layerCount = active.endLayer - active.startLayer
    const step = Math.min(layerCount, Math.floor(elapsed / durationPerLayer))
    if (step > active.step) {
      for (let finishedStep = active.step; finishedStep < step; finishedStep += 1) {
        const finishedLayer = active.adding
          ? active.startLayer + finishedStep
          : active.endLayer - 1 - finishedStep
        const finishedStart = finishedLayer * layerSize
        for (let index = finishedStart; index < finishedStart + layerSize; index += 1) {
          if (active.adding) setCubeMatrix(index)
          else setCubeMatrix(index, 0.01, unitScale * 0.65)
        }
      }
      active.step = step
    }
    if (step >= layerCount) {
      if (active.adding) {
        const startIndex = active.startLayer * layerSize
        const endIndex = active.endLayer * layerSize
        for (let index = startIndex; index < endIndex; index += 1) setCubeMatrix(index)
      }
      mesh.count = active.finalCount
      mesh.instanceMatrix.needsUpdate = true
      animation.current = null
      return
    }
    const t = Math.min(1, Math.max(0, (elapsed - step * durationPerLayer) / durationPerLayer))
    const eased = 1 - (1 - t) ** 3
    const currentLayer = active.adding
      ? active.startLayer + step
      : active.endLayer - 1 - step
    const startIndex = currentLayer * layerSize
    const endIndex = startIndex + layerSize
    for (let index = startIndex; index < endIndex; index += 1) {
      if (active.adding) setCubeMatrix(index, 0.16 + 0.84 * eased, unitScale * 0.85 * (1 - eased))
      else setCubeMatrix(index, Math.max(0.01, 1 - eased), unitScale * 0.65 * eased)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, capacity + 1)]} castShadow receiveShadow frustumCulled={false}>
      <boxGeometry args={[unitScale * 0.91, unitScale * 0.91, unitScale * 0.91]} />
      <meshStandardMaterial color="#5f98ef" roughness={0.48} />
  </instancedMesh>
}

function CylinderGrid({ radius, y, unitScale }: { radius: number; y: number; unitScale: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const cells = useMemo(() => {
    const result: [number, number][] = []
    const cellSize = Math.min(unitScale, Math.max(0.25, radius / 3))
    const extent = Math.ceil(radius / cellSize)
    for (let x = -extent; x < extent; x += 1) {
      for (let z = -extent; z < extent; z += 1) {
        const centerX = (x + 0.5) * cellSize
        const centerZ = (z + 0.5) * cellSize
        if (centerX ** 2 + centerZ ** 2 <= radius ** 2) result.push([centerX, centerZ])
      }
    }
    return { cells: result, cellSize }
  }, [radius, unitScale])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  useEffect(() => {
    if (!ref.current) return
    cells.cells.forEach(([x, z], i) => {
      matrix.makeTranslation(x, y, z)
      ref.current!.setMatrixAt(i, matrix)
    })
    ref.current.count = cells.cells.length
    ref.current.instanceMatrix.needsUpdate = true
  }, [cells, matrix, y])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.cells.length]}>
      <boxGeometry args={[cells.cellSize * 0.92, 0.025, cells.cellSize * 0.92]} />
      <meshStandardMaterial color="#f5aa5c" roughness={0.7} />
    </instancedMesh>
  )
}

function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera } = useThree()
  const controls = useRef<any>(null)
  useEffect(() => {
    camera.position.set(10, 8, 11)
    camera.lookAt(0, 2.5, 0)
    controls.current?.target.set(0, 2.5, 0)
    controls.current?.update()
  }, [camera, resetKey])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.075} minDistance={5} maxDistance={32} maxPolarAngle={Math.PI / 2 - 0.035} target={[0, 2.5, 0]} />
}

export default function Scene(props: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10, 8, 11], fov: 37 }} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#f4f7fa']} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[7, 12, 6]} intensity={2.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 7, -5]} intensity={0.45} color="#d9e8ff" />
      {props.showGrid && <gridHelper args={[24, 24, '#ccd6e3', '#e0e6ee']} position={[0, -0.015, 0]} />}
      {props.showAxes && <axesHelper args={[5]} position={[0, 0.015, 0]} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial opacity={0.11} />
      </mesh>
      <ContactShadows position={[0, -0.025, 0]} scale={18} opacity={0.19} blur={2.5} far={10} />
      <SolidShape {...props} />
      <CameraReset resetKey={props.resetCameraKey} />
    </Canvas>
  )
}
