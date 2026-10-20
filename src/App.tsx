import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Cylinder,
  FlaskConical,
  Grid3X3,
  Layers,
  Lightbulb,
  Maximize2,
  Move3d,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shapes,
  Shuffle,
  Target,
  X,
} from 'lucide-react'
import Scene from './components/Scene'
import {
  defaultDimensions,
  formatNumber,
  formatVolume,
  getUnitCount,
  modeLabels,
  shapeDimensions,
  shapeLabels,
  volumeFor,
} from './math'
import type { Dimensions, Mode, Shape, Unit } from './math'

type FieldKey = 'side' | 'length' | 'width' | 'height' | 'radius'
type AnswerKind = 'volume' | 'length' | 'factor'
interface Challenge {
  shape: Shape
  dimensions: Dimensions
  prompt: (unit: Unit, factor: number) => string
  hint: string
  explanation: (unit: Unit, factor: number) => string
  answer: number
  answerKind: AnswerKind
}
interface ExperimentRow {
  id: number
  length: number
  width: number
  height: number
  volume: number
}

const fieldSpecs: Record<FieldKey, { label: string; min: number; max: number }> = {
  side: { label: 'Side length', min: 1, max: 10 },
  length: { label: 'Length', min: 1, max: 10 },
  width: { label: 'Width', min: 1, max: 10 },
  height: { label: 'Height', min: 1, max: 10 },
  radius: { label: 'Radius', min: 1, max: 6 },
}

function makeChallenge(): Challenge {
  const kind = Math.floor(Math.random() * 3)
  const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  if (kind === 0) {
    const length = rnd(2, 7), width = rnd(2, 5), height = rnd(2, 6)
    const dimensions = { ...defaultDimensions, length, width, height }
    return {
      shape: 'cuboid', dimensions,
      prompt: (unit, factor) => `A storage box is ${formatNumber(length / factor)} ${unit} long, ${formatNumber(width / factor)} ${unit} wide, and ${formatNumber(height / factor)} ${unit} high. What is its volume?`,
      hint: 'Multiply the length, width, and height. Volume counts how many 1 cubic-unit cubes fit inside.',
      explanation: (unit, factor) => `${formatNumber(length / factor)} × ${formatNumber(width / factor)} × ${formatNumber(height / factor)} = ${formatVolume(length * width * height / factor ** 3)} ${unitLabel(unit, 3)}.`,
      answer: length * width * height, answerKind: 'volume',
    }
  }
  if (kind === 1) {
    const length = rnd(2, 6), width = rnd(2, 5), height = rnd(2, 6), volume = length * width * height
    const dimensions = { ...defaultDimensions, length, width, height }
    return {
      shape: 'cuboid', dimensions,
      prompt: (unit, factor) => `A box holds ${formatVolume(volume / factor ** 3)} ${unitLabel(unit, 3)}. Its base is ${formatNumber(length / factor)} ${unit} by ${formatNumber(width / factor)} ${unit}. How tall is it?`,
      hint: 'First find the base area: length × width. Then divide the volume by that area.',
      explanation: (unit, factor) => `${formatVolume(volume / factor ** 3)} ÷ (${formatNumber(length / factor)} × ${formatNumber(width / factor)}) = ${formatNumber(height / factor)} ${unit}.`,
      answer: height, answerKind: 'length',
    }
  }
  const side = rnd(2, 5)
  return {
    shape: 'cube', dimensions: { ...defaultDimensions, side },
    prompt: (unit, factor) => `A cube has a side length of ${formatNumber(side / factor)} ${unit}. If its side length doubles, how many times greater is its volume?`,
    hint: 'Compare (2s)³ with s³. Each of the three dimensions is doubled.',
    explanation: () => `The new volume is (2s)³ = 2³s³, so it is 8 times the original volume.`,
    answer: 8, answerKind: 'factor',
  }
}

function unitPower(unit: Unit) { return unit === 'cm' ? 1 : 100 }
function unitLabel(unit: Unit, power = 1) { return `${unit}${power === 1 ? '' : power === 2 ? '²' : '³'}` }
function clean(value: number) { return Number(value.toFixed(3)) }

function App() {
  const [shape, setShape] = useState<Shape>('cuboid')
  const [mode, setMode] = useState<Mode>('explore')
  const [unit, setUnit] = useState<Unit>('cm')
  const [dimensions, setDimensions] = useState<Dimensions>({ ...defaultDimensions })
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(false)
  const [showUnitCubes, setShowUnitCubes] = useState(true)
  const [construction, setConstruction] = useState({ length: 5, width: 3, layers: 1 })
  const [autoBuild, setAutoBuild] = useState(false)
  const [layersPerSecond, setLayersPerSecond] = useState(1)
  const [cylinderApproximation, setCylinderApproximation] = useState(false)
  const [cameraKey, setCameraKey] = useState(0)
  const [challenge, setChallenge] = useState<Challenge>(makeChallenge)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [challengeFeedback, setChallengeFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [challengeSolved, setChallengeSolved] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [solved, setSolved] = useState(0)
  const [records, setRecords] = useState<ExperimentRow[]>([])
  const [observation, setObservation] = useState('')
  const [observations, setObservations] = useState<string[]>([])
  const [experimentId, setExperimentId] = useState(0)
  const workspaceRef = useRef<HTMLDivElement>(null)

  const factor = unitPower(unit)
  const cubicLabel = unitLabel(unit, 3)
  const actualFill = mode === 'fill' && shape !== 'cylinder'
  const calculationShape: Shape = actualFill ? 'cuboid' : shape
  const calculationDimensions: Dimensions = actualFill
    ? { ...dimensions, length: construction.length * factor, width: construction.width * factor, height: construction.layers * factor }
    : dimensions
  const sceneDimensions: Dimensions = actualFill
    ? { ...dimensions, length: construction.length, width: construction.width, height: construction.layers }
    : dimensions
  const dimensionsForShape = shapeDimensions(calculationShape, calculationDimensions)
  const volume = volumeFor(calculationShape, calculationDimensions)
  const [countX, countZ, countY] = actualFill
    ? [construction.length, construction.width, construction.layers]
    : getUnitCount(shape, dimensions, factor)
  const totalCubes = countX * countZ * countY
  const visibleCubeCount = actualFill ? totalCubes : 0
  const shownVolume = volume / factor ** 3

  useEffect(() => {
    if (!autoBuild) return
    const timer = window.setInterval(() => {
      if (construction.layers >= 10) {
        setAutoBuild(false)
        return
      }
      const nextLayer = construction.layers + 1
      setConstruction((current) => {
        return { ...current, layers: Math.min(10, current.layers + 1) }
      })
      if (nextLayer >= 10) setAutoBuild(false)
    }, 1000 / layersPerSecond)
    return () => window.clearInterval(timer)
  }, [autoBuild, layersPerSecond, construction.layers])

  useEffect(() => {
    if (mode === 'challenge') {
      setShape(challenge.shape)
      setDimensions({ ...challenge.dimensions })
      setAutoBuild(false)
    }
  }, [mode, challenge])

  const displayedDimensions = useMemo(() => dimensionsForShape.map((n) => n / factor), [dimensionsForShape, factor])
  const formula = actualFill ? 'Volume = Length × Width × Layers' : shape === 'cube' ? 'V = s³' : shape === 'cuboid' ? 'V = l × w × h' : 'V = πr²h'
  const substitution = actualFill
    ? `${construction.length} × ${construction.width} × ${construction.layers}`
    : shape === 'cube'
    ? `${formatNumber(displayedDimensions[0])}³`
    : shape === 'cuboid'
      ? displayedDimensions.map((n) => formatNumber(n)).join(' × ')
      : `π × ${formatNumber(dimensions.radius / factor)}² × ${formatNumber(dimensions.height / factor)}`
  function setDimension(key: FieldKey, inputValue: number) {
    const { min, max } = fieldSpecs[key]
    const value = Math.max(min, Math.min(max, clean(inputValue * factor)))
    if (!Number.isFinite(value)) return
    setAutoBuild(false)
    setDimensions((current) => ({ ...current, [key]: value }))
  }

  function selectShape(nextShape: Shape) {
    setShape(nextShape)
    setShowUnitCubes(true)
    setAutoBuild(false)
    if (nextShape === 'cylinder') setCylinderApproximation(true)
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode)
    setAutoBuild(false)
    if (nextMode === 'experiment') {
      setShape('cuboid')
      setDimensions((current) => ({ ...current, length: 1, width: 3, height: 2 }))
      setAutoBuild(false)
    }
    if (nextMode === 'challenge') {
      setShape(challenge.shape)
      setDimensions({ ...challenge.dimensions })
      setChallengeFeedback(null)
      setChallengeAnswer('')
    }
  }

  function applyPreset(index: number) {
    setAutoBuild(false)
    setDimensions((current) => {
      if (shape === 'cube') return { ...current, side: [3, 5, 8][index] }
      if (shape === 'cuboid') {
        const presets = [[3, 2, 2], [5, 3, 4], [7, 4, 2]]
        const [length, width, height] = presets[index]
        return { ...current, length, width, height }
      }
      const presets = [[2, 4], [3, 5], [4, 8]]
      const [radius, height] = presets[index]
      return { ...current, radius, height }
    })
  }

  function resetCurrentShape() {
    setDimensions((current) => {
      if (shape === 'cube') return { ...current, side: defaultDimensions.side }
      if (shape === 'cuboid') return { ...current, length: defaultDimensions.length, width: defaultDimensions.width, height: defaultDimensions.height }
      return { ...current, radius: defaultDimensions.radius, height: defaultDimensions.height }
    })
    setAutoBuild(false)
  }

  function setConstructionDimension(axis: 'length' | 'width' | 'layers', value: number) {
    const nextValue = Math.max(1, Math.min(10, Math.round(value)))
    setAutoBuild(false)
    setConstruction((current) => axis === 'layers'
      ? { ...current, layers: nextValue }
      : { ...current, [axis]: nextValue, layers: 1 })
  }

  function resetConstruction() {
    setAutoBuild(false)
    setConstruction({ length: 5, width: 3, layers: 1 })
  }

  function resetEverything() {
    setShape('cuboid')
    setMode('explore')
    setUnit('cm')
    setDimensions({ ...defaultDimensions })
    setConstruction({ length: 5, width: 3, layers: 1 })
    setAutoBuild(false)
    setShowUnitCubes(true)
    setShowGrid(true)
    setShowAxes(false)
    setCylinderApproximation(false)
    setRecords([])
    setObservations([])
    setObservation('')
    setExperimentId(0)
    setSolved(0)
    setChallengeSolved(false)
    setChallenge(makeChallenge())
    setChallengeAnswer('')
    setChallengeFeedback(null)
    setCameraKey((key) => key + 1)
  }

  function newChallenge() {
    const next = makeChallenge()
    setChallenge(next)
    setChallengeAnswer('')
    setChallengeFeedback(null)
    setChallengeSolved(false)
    setShowHint(false)
    setMode('challenge')
  }

  function answerValue() {
    if (challenge.answerKind === 'volume') return challenge.answer / factor ** 3
    if (challenge.answerKind === 'length') return challenge.answer / factor
    return challenge.answer
  }

  function submitChallenge(event: React.FormEvent) {
    event.preventDefault()
    const given = Number(challengeAnswer)
    const expected = answerValue()
    const tolerance = challenge.answerKind === 'factor' ? 0.01 : Math.max(1e-8, Math.abs(expected) * 0.001)
    const correct = Number.isFinite(given) && Math.abs(given - expected) <= tolerance
    setChallengeFeedback(correct ? 'correct' : 'incorrect')
    if (correct && !challengeSolved) {
      setSolved((value) => value + 1)
      setChallengeSolved(true)
    }
  }

  function recordExperiment() {
    setRecords((rows) => [...rows, { id: experimentId + 1, length: dimensions.length, width: dimensions.width, height: dimensions.height, volume: dimensions.length * dimensions.width * dimensions.height }])
    setExperimentId((id) => id + 1)
  }

  function addObservation(event: React.FormEvent) {
    event.preventDefault()
    const note = observation.trim()
    if (!note) return
    setObservations((items) => [...items, note])
    setObservation('')
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await workspaceRef.current?.requestFullscreen()
    } catch {
      // Fullscreen is optional on browsers that do not grant it.
    }
  }

  const activityCopy: Record<Mode, string> = {
    explore: 'Explore shapes and see volume change',
    fill: 'Build a cuboid one complete layer at a time',
    challenge: 'Try a quick volume challenge',
    experiment: 'Investigate how dimensions affect volume',
  }

  return (
    <div className="app-shell" ref={workspaceRef}>
      <header className="topbar">
        <div className="topbar-activity"><span className="activity-dot" /> <span>{modeLabels[mode]}</span></div>
        <div className="topbar-actions">
          <div className="unit-switch" role="group" aria-label="Measurement unit">
            <button type="button" className={unit === 'cm' ? 'selected' : ''} aria-pressed={unit === 'cm'} onClick={() => setUnit('cm')}>cm</button>
            <button type="button" className={unit === 'm' ? 'selected' : ''} aria-pressed={unit === 'm'} onClick={() => setUnit('m')}>m</button>
          </div>
          <button className="icon-button reset-top" onClick={resetEverything} title="Reset simulation" aria-label="Reset simulation"><RotateCcw size={16} /><span>Reset</span></button>
          <button className="icon-button fullscreen-button" onClick={() => void toggleFullscreen()} title="Toggle fullscreen" aria-label="Toggle fullscreen"><Maximize2 size={16} /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar sidebar-left">
          <section className="sidebar-section">
            <div className="section-label">SHAPE</div>
            <div className="shape-list">
              {(['cube', 'cuboid', 'cylinder'] as Shape[]).map((item) => {
                const Icon = item === 'cube' ? Box : item === 'cuboid' ? Shapes : Cylinder
                return <button key={item} className={`shape-option ${shape === item ? 'active' : ''}`} onClick={() => selectShape(item)} aria-pressed={shape === item}>
                  <span className="shape-icon"><Icon size={18} strokeWidth={1.8} /></span>
                  <span><b>{shapeLabels[item]}</b><small>{item === 'cube' ? 'Equal sides' : item === 'cuboid' ? 'Three dimensions' : 'Circular base'}</small></span>
                  {shape === item && <span className="selected-mark"><Check size={13} /></span>}
                </button>
              })}
            </div>
          </section>
          <section className="sidebar-section mode-section">
            <div className="section-label">LEARNING MODE</div>
            <div className="mode-list">
              {([
                ['explore', Move3d], ['fill', Layers], ['challenge', Target], ['experiment', FlaskConical],
              ] as [Mode, typeof Move3d][]).map(([item, Icon]) => <button key={item} className={`mode-option ${mode === item ? 'active' : ''}`} onClick={() => changeMode(item)} aria-pressed={mode === item}>
                <Icon size={17} strokeWidth={1.8} /><span>{modeLabels[item]}</span>{mode === item && <span className="mode-active-dot" />}
              </button>)}
            </div>
          </section>
          <div className="sidebar-footnote"><div className="footnote-icon"><Lightbulb size={16} /></div><p><b>Think in 3D</b><br />Volume measures the space inside a shape.</p></div>
        </aside>

        <main className="simulation-column">
          <div className="canvas-card">
            <div className="canvas-heading">
              <div><div className="eyebrow">{mode === 'challenge' ? 'QUICK CHECK' : mode === 'experiment' ? 'INVESTIGATION 01' : '3D SIMULATOR'}</div><h1>{mode === 'challenge' ? 'Show what you know' : mode === 'experiment' ? 'Change one thing at a time' : mode === 'fill' && shape === 'cylinder' ? 'Cylinder base preview' : mode === 'fill' ? 'Build a cuboid' : `${shapeLabels[shape]} in space`}</h1><p>{mode === 'fill' && shape === 'cylinder' ? 'Approximate the base area with square cells' : activityCopy[mode]}</p></div>
              <div className="drag-hint"><Move3d size={14} /> Drag to rotate</div>
            </div>
            <div className="viewport-wrap">
            <div className="viewport-badges">
                <span className="live-badge"><i /> LIVE MODEL</span>
                {mode === 'fill' && shape !== 'cylinder' && <span className="unit-badge"><span className="mini-cube" /> 1 {unitLabel(unit, 3)} each</span>}
                {mode === 'experiment' && <span className="fixed-badge">Width & height fixed</span>}
              </div>
              <Scene
                shape={calculationShape}
                dimensions={sceneDimensions}
                fill={actualFill}
                showUnitCubes={showUnitCubes}
                cubeCount={visibleCubeCount}
                showGrid={showGrid}
                showAxes={showAxes}
                cylinderApproximation={mode === 'fill' && shape === 'cylinder' && cylinderApproximation}
                resetCameraKey={cameraKey}
                unitScale={actualFill ? 1 : factor}
                unit={unit}
              />
              <div className="viewport-tools">
                <button className={`viewport-tool ${showGrid ? 'tool-on' : ''}`} onClick={() => setShowGrid((value) => !value)} title="Toggle floor grid" aria-pressed={showGrid}><Grid3X3 size={15} /><span>Grid</span></button>
                <button className={`viewport-tool ${showAxes ? 'tool-on' : ''}`} onClick={() => setShowAxes((value) => !value)} title="Toggle coordinate axes" aria-pressed={showAxes}><Move3d size={15} /><span>Axes</span></button>
                <span className="tool-divider" />
                <button className="viewport-tool" onClick={() => setCameraKey((key) => key + 1)} title="Reset camera"><RotateCcw size={15} /><span>Camera</span></button>
              </div>
              {actualFill && <div className="layer-indicator"><span className="layer-icon"><Layers size={15} /></span><div><b>{totalCubes.toLocaleString()} unit cubes</b><span>{construction.layers} completed {construction.layers === 1 ? 'layer' : 'layers'}</span></div></div>}
            </div>
            <div className="viewport-footer"><span><CircleHelp size={14} /> Scroll to zoom · Right-drag to pan</span><span className="axis-key"><i className="key-x" /> X <i className="key-y" /> Y <i className="key-z" /> Z</span></div>
          </div>
          {actualFill && <LayerBuilderControls
            construction={construction} autoBuild={autoBuild} layersPerSecond={layersPerSecond}
            setDimension={setConstructionDimension} setAutoBuild={setAutoBuild} setLayersPerSecond={setLayersPerSecond} reset={resetConstruction}
          />}
          {mode === 'experiment' && <ExperimentStrip records={records} unit={unit} factor={factor} dimensions={dimensions} />}
        </main>

        <aside className="sidebar sidebar-right">
          {mode === 'challenge' ? <ChallengePanel
            challenge={challenge} unit={unit} factor={factor} answer={challengeAnswer} setAnswer={setChallengeAnswer}
            feedback={challengeFeedback} submit={submitChallenge} hint={showHint} setHint={setShowHint} solved={solved} newChallenge={newChallenge}
          /> : mode === 'experiment' ? <ExperimentPanel
            dimensions={dimensions} unit={unit} factor={factor} setDimension={setDimension} volume={volume} records={records}
            onRecord={recordExperiment} observation={observation} setObservation={setObservation} addObservation={addObservation}
            observations={observations} reset={() => { setRecords([]); setObservations([]); setObservation(''); setExperimentId(0); setDimensions((current) => ({ ...current, length: 1, width: 3, height: 2 })) }}
          /> : <>
            {actualFill ? <div className="panel-title-row"><div><div className="section-label">LAYER CONSTRUCTION</div><h2>Build summary</h2></div><button className="subtle-icon" onClick={resetConstruction} title="Reset construction" aria-label="Reset construction"><RotateCcw size={15} /></button></div> : <>
              <div className="panel-title-row"><div><div className="section-label">SHAPE CONTROLS</div><h2>Dimensions</h2></div><button className="subtle-icon" onClick={resetCurrentShape} title="Reset dimensions" aria-label="Reset dimensions"><RotateCcw size={15} /></button></div>
              <div className="controls-hint">Set the measurements for your {shapeLabels[shape].toLowerCase()}.</div>
              <div className="dimension-fields">
                {(shape === 'cube' ? ['side'] : shape === 'cuboid' ? ['length', 'width', 'height'] : ['radius', 'height']).map((key) => <DimensionField
                  key={key} field={key as FieldKey} baseValue={dimensions[key as FieldKey]} unit={unit} factor={factor} setValue={setDimension}
                />)}
              </div>
              <div className="preset-block"><div className="mini-label">TRY AN EXAMPLE</div><div className="preset-list">
                {(shape === 'cube' ? ['Small', 'Medium', 'Large'] : shape === 'cuboid' ? ['Compact', 'Classic', 'Long'] : ['Narrow', 'Classic', 'Wide']).map((label, i) => <button key={label} className="preset-chip" onClick={() => applyPreset(i)}>{label}</button>)}
              </div></div>
            </>}

            {mode === 'fill' && <FillPanel
              shape={shape} length={construction.length} width={construction.width} layers={construction.layers}
              totalCubes={totalCubes}
              showUnitCubes={showUnitCubes} setShowUnitCubes={setShowUnitCubes}
              cylinderApproximation={cylinderApproximation} setCylinderApproximation={setCylinderApproximation} volume={shownVolume} cubicLabel={cubicLabel}
            />}
            {(mode !== 'fill' || shape !== 'cylinder') && <CalculationCard shape={calculationShape} dimensions={calculationDimensions} unit={unit} formula={formula} substitution={substitution} result={shownVolume} />}
            {mode === 'explore' && <div className="insight-note"><div className="insight-icon"><Lightbulb size={16} /></div><p><b>Notice</b><br />Change one dimension and watch how much the volume changes.</p></div>}
          </>}
        </aside>
      </div>
    </div>
  )
}

function DimensionField({ field, baseValue, unit, factor, setValue }: { field: FieldKey; baseValue: number; unit: Unit; factor: number; setValue: (key: FieldKey, value: number) => void }) {
  const spec = fieldSpecs[field]
  const value = baseValue / factor
  const min = spec.min / factor
  const max = spec.max / factor
  const step = unit === 'cm' ? 0.1 : 0.001
  const formatted = unit === 'cm' ? formatNumber(value, 1) : formatNumber(value, 3)
  const progress = Math.max(0, Math.min(100, (value - min) / (max - min) * 100))
  return <div className="dimension-field">
    <div className="field-topline"><label htmlFor={`field-${field}`}>{spec.label}</label><span className="field-readout">{formatted} <small>{unit}</small></span></div>
    <div className="field-inputs">
      <input className="range-input" type="range" min={min} max={max} step={step} value={value} style={{ background: `linear-gradient(to right, #6694e7 0%, #6694e7 ${progress}%, #e6ebf1 ${progress}%, #e6ebf1 100%)` }} onChange={(event) => setValue(field, Number(event.target.value))} aria-label={`${spec.label} slider`} />
      <div className="number-wrap"><input id={`field-${field}`} type="number" min={min} max={max} step={step} value={formatted} onChange={(event) => { if (event.target.value !== '') setValue(field, Number(event.target.value)) }} aria-label={`${spec.label} value`} /><span>{unit}</span></div>
    </div>
    <div className="range-limits"><span>{formatNumber(min, unit === 'cm' ? 0 : 2)}</span><span>{formatNumber(max, unit === 'cm' ? 0 : 2)}</span></div>
  </div>
}

function CalculationCard({ shape, dimensions, unit, formula, substitution, result }: { shape: Shape; dimensions: Dimensions; unit: Unit; formula: string; substitution: string; result: number }) {
  const factor = unitPower(unit)
  const values = shapeDimensions(shape, dimensions).map((value) => formatNumber(value / factor))
  const displayDims = shape === 'cube' ? `${values[0]} ${unit}` : shape === 'cuboid' ? `${values[0]} × ${values[1]} × ${values[2]} ${unit}` : `r = ${formatNumber(dimensions.radius / factor)} ${unit} · h = ${formatNumber(dimensions.height / factor)} ${unit}`
  const exact = shape === 'cylinder' ? `π × ${formatNumber(dimensions.radius / factor)}² × ${formatNumber(dimensions.height / factor)}` : substitution
  return <section className="calculation-card">
    <div className="calc-heading"><span className="calc-symbol">ƒ</span><div><span className="mini-label">VOLUME CALCULATION</span><h3>{shapeLabels[shape]}</h3></div></div>
    <div className="calc-dimensions"><span>Dimensions</span><b>{displayDims}</b></div>
    <div className="formula-block"><span className="mini-label">FORMULA</span><div>{formula}</div></div>
    <div className="formula-block"><span className="mini-label">SUBSTITUTE</span><div>{exact}</div></div>
    <div className="calc-result"><span>Volume</span><b>{formatVolume(result)} <sup>{unit === 'cm' ? 'cm³' : 'm³'}</sup></b></div>
  </section>
}

function LayerBuilderControls({ construction, autoBuild, layersPerSecond, setDimension, setAutoBuild, setLayersPerSecond, reset }: {
  construction: { length: number; width: number; layers: number }; autoBuild: boolean; layersPerSecond: number;
  setDimension: (axis: 'length' | 'width' | 'layers', value: number) => void; setAutoBuild: (value: boolean) => void;
  setLayersPerSecond: (value: number) => void; reset: () => void
}) {
  const total = construction.length * construction.width * construction.layers
  const axes = [
    { key: 'length' as const, label: 'Length', axis: 'X', value: construction.length },
    { key: 'width' as const, label: 'Width', axis: 'Y', value: construction.width },
    { key: 'layers' as const, label: 'Layers', axis: 'Z', value: construction.layers },
  ]
  return <section className="axis-builder-card" aria-labelledby="builder-title">
    <div className="builder-heading">
      <div><div className="eyebrow">INTERACTIVE CONSTRUCTION</div><h2 id="builder-title">Build one layer at a time</h2></div>
      <div className="builder-readout" aria-live="polite"><b>{construction.length} × {construction.width} × {construction.layers}</b><span>{total} unit cubes</span></div>
    </div>
    <div className="axis-slider-grid">
      {axes.map(({ key, label, axis, value }) => {
        const progress = (value - 1) / 9 * 100
        return <div className="axis-slider-field" key={key}>
          <div className="axis-slider-label"><label htmlFor={`axis-${key}`}>{label} <span>({axis})</span></label><b>{value}</b></div>
          <input id={`axis-${key}`} className="axis-slider" type="range" min={1} max={10} step={1} value={value}
            aria-label={`${label} (${axis})`} aria-valuetext={`${value} ${label.toLowerCase()}`}
            style={{ background: `linear-gradient(to right, #5b8fe4 0%, #5b8fe4 ${progress}%, #e6ebf1 ${progress}%, #e6ebf1 100%)` }}
            onChange={(event) => setDimension(key, Number(event.currentTarget.value))} />
          <div className="axis-slider-limits"><span>1</span><span>10</span></div>
        </div>
      })}
    </div>
    <div className="builder-actions">
      <div className="playback-controls" aria-label="Layer playback controls">
        <button className="playback-button" onClick={() => setAutoBuild(true)} disabled={autoBuild || construction.layers >= 10} aria-label="Play layer construction" title="Play"><Play size={15} fill="currentColor" /><span>Add layers</span></button>
        <button className="playback-button" onClick={() => setAutoBuild(false)} disabled={!autoBuild} aria-label="Pause layer construction" title="Pause"><Pause size={15} fill="currentColor" /><span>Pause</span></button>
        <label className="playback-rate"><span>Rate</span><select aria-label="Layer construction rate" value={layersPerSecond} onChange={(event) => setLayersPerSecond(Number(event.currentTarget.value))}>
          <option value={0.5}>1 layer / 2 sec</option><option value={1}>1 layer / sec</option><option value={2}>2 layers / sec</option>
        </select></label>
      </div>
      <button className="builder-reset" onClick={reset} aria-label="Reset construction"><RotateCcw size={14} />Reset</button>
    </div>
  </section>
}

function FillPanel({ shape, length, width, layers, totalCubes, showUnitCubes, setShowUnitCubes, cylinderApproximation, setCylinderApproximation, volume, cubicLabel }: {
  shape: Shape; length: number; width: number; layers: number; totalCubes: number;
  showUnitCubes: boolean; setShowUnitCubes: (value: boolean) => void;
  cylinderApproximation: boolean; setCylinderApproximation: (value: boolean) => void; volume: number; cubicLabel: string
}) {
  if (shape === 'cylinder') return <section className="fill-card">
    <div className="fill-card-heading"><span className="control-icon amber"><Grid3X3 size={17} /></span><div><h3>Base area preview</h3><p>Approximate with square cells</p></div></div>
    <p className="cylinder-explainer">A cylinder cannot be filled exactly with whole unit cubes. This grid estimates the circular base area; the volume calculation remains exact.</p>
    <button className={`toggle-row ${cylinderApproximation ? 'toggle-on' : ''}`} onClick={() => setCylinderApproximation(!cylinderApproximation)} aria-pressed={cylinderApproximation}><span className="toggle-copy"><Grid3X3 size={15} />Show base grid</span><span className="switch"><i /></span></button>
    <div className="approx-result"><span>Exact volume</span><b>{formatVolume(volume)} {cubicLabel}</b></div>
  </section>

  const cubesPerLayer = length * width
  return <section className="fill-card">
    <div className="fill-card-heading"><span className="control-icon blue"><Layers size={17} /></span><div><h3>Constructed volume</h3><p>{layers} completed {layers === 1 ? 'layer' : 'layers'} · {formatVolume(volume)} {cubicLabel}</p></div></div>
    <div className="unit-count-grid"><div><span>Cubes per layer</span><b>{cubesPerLayer}</b></div><div><span>Completed layers</span><b>{layers}</b></div><div><span>Total unit cubes</span><b>{totalCubes.toLocaleString()}</b></div></div>
    <div className="fill-total"><span>Current volume</span><b>{formatVolume(volume)} <small>{length} × {width} × {layers} {cubicLabel}</small></b></div>
    <button className="toggle-row" onClick={() => setShowUnitCubes(!showUnitCubes)} aria-pressed={showUnitCubes}><span className="toggle-copy"><Box size={15} />Show individual cubes</span><span className={`switch ${showUnitCubes ? 'switch-active' : ''}`}><i /></span></button>
  </section>
}

function ChallengePanel({ challenge, unit, factor, answer, setAnswer, feedback, submit, hint, setHint, solved, newChallenge }: {
  challenge: Challenge; unit: Unit; factor: number; answer: string; setAnswer: (value: string) => void; feedback: 'correct' | 'incorrect' | null;
  submit: (event: React.FormEvent) => void; hint: boolean; setHint: (value: boolean) => void; solved: number; newChallenge: () => void
}) {
  const shownAnswer = challenge.answerKind === 'volume' ? challenge.answer / factor ** 3 : challenge.answerKind === 'length' ? challenge.answer / factor : challenge.answer
  const answerSuffix = challenge.answerKind === 'volume' ? unitLabel(unit, 3) : challenge.answerKind === 'length' ? unit : 'times'
  return <div className="challenge-panel">
    <div className="panel-title-row"><div><div className="section-label">CHALLENGE</div><h2>Quick check</h2></div><span className="score-pill"><Check size={13} />{solved} solved</span></div>
    <div className="challenge-card"><div className="challenge-number"><Target size={15} />YOUR QUESTION</div><p>{challenge.prompt(unit, factor)}</p>
      <form onSubmit={submit}>
        <label className="mini-label" htmlFor="challenge-answer">YOUR ANSWER</label>
        <div className="answer-input-wrap"><input id="challenge-answer" type="number" step="any" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type a number" aria-describedby="answer-unit" /><span id="answer-unit">{answerSuffix}</span></div>
        <button type="submit" className="submit-answer" disabled={answer.trim() === ''}><Check size={16} />Check answer</button>
      </form>
      {feedback && <div className={`answer-feedback ${feedback}`} role="status"><div className="feedback-title">{feedback === 'correct' ? <><Check size={16} /> That's right!</> : <><X size={16} /> Not quite yet</>}</div><p>{feedback === 'correct' ? challenge.explanation(unit, factor) : `Try again. ${challenge.hint}`}</p>{feedback === 'incorrect' && <span className="answer-reveal">Answer: {challenge.answerKind === 'volume' ? formatVolume(shownAnswer) : formatNumber(shownAnswer)} {answerSuffix}</span>}</div>}
    </div>
    <button className={`hint-button ${hint ? 'hint-open' : ''}`} onClick={() => setHint(!hint)}><Lightbulb size={15} />{hint ? 'Hide hint' : 'Need a hint?'}<ChevronDown size={14} /></button>
    {hint && <div className="hint-content">{challenge.hint}</div>}
    <button className="new-challenge" onClick={newChallenge}><Shuffle size={15} />New challenge</button>
    <div className="challenge-tip"><Lightbulb size={15} /><span>Use the model to reason it out, then enter your result above.</span></div>
  </div>
}

function ExperimentPanel({ dimensions, unit, factor, setDimension, volume, records, onRecord, observation, setObservation, addObservation, observations, reset }: {
  dimensions: Dimensions; unit: Unit; factor: number; setDimension: (key: FieldKey, value: number) => void; volume: number; records: ExperimentRow[];
  onRecord: () => void; observation: string; setObservation: (value: string) => void; addObservation: (event: React.FormEvent) => void; observations: string[]; reset: () => void
}) {
  return <div className="experiment-panel">
    <div className="panel-title-row"><div><div className="section-label">INVESTIGATION</div><h2>Change the length</h2></div><button className="subtle-icon" onClick={reset} title="Reset experiment" aria-label="Reset experiment"><RotateCcw size={15} /></button></div>
    <p className="experiment-intro">Keep width and height fixed. Record how volume responds as length changes.</p>
    <div className="fixed-values"><div><span>Width <i>FIXED</i></span><b>{formatNumber(dimensions.width / factor)} {unit}</b></div><div><span>Height <i>FIXED</i></span><b>{formatNumber(dimensions.height / factor)} {unit}</b></div></div>
    <DimensionField field="length" baseValue={dimensions.length} unit={unit} factor={factor} setValue={setDimension} />
    <div className="current-volume"><span>Current volume</span><b>{formatVolume(volume / factor ** 3)} <sup>{unitLabel(unit, 3)}</sup></b></div>
    <button className="record-button" onClick={onRecord}><Plus size={16} />Record this result</button>
    <div className="experiment-divider" />
    <div className="records-heading"><span>RECORDED RESULTS</span><b>{records.length}</b></div>
    {records.length === 0 ? <div className="empty-records">Move the length slider, then record a result to begin.</div> : <div className="records-table-wrap"><table className="records-table"><thead><tr><th>#</th><th>Length</th><th>Width</th><th>Height</th><th>Volume</th></tr></thead><tbody>{records.map((row) => <tr key={row.id}><td>{row.id}</td><td>{formatNumber(row.length / factor)}</td><td>{formatNumber(row.width / factor)}</td><td>{formatNumber(row.height / factor)}</td><td>{formatVolume(row.volume / factor ** 3)}</td></tr>)}</tbody></table></div>}
    <form className="observation-form" onSubmit={addObservation}><label htmlFor="observation">OBSERVATION</label><div><input id="observation" value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="What pattern do you notice?" /><button type="submit" disabled={!observation.trim()} aria-label="Add observation"><Plus size={15} /></button></div></form>
    {observations.length > 0 && <ul className="observation-list">{observations.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>}
  </div>
}

function ExperimentStrip({ records, unit, factor, dimensions }: { records: ExperimentRow[]; unit: Unit; factor: number; dimensions: Dimensions }) {
  const volumePerUnit = dimensions.width * dimensions.height / factor ** 2
  return <div className="experiment-strip"><div className="strip-icon"><FlaskConical size={17} /></div><div><b>Investigation in progress</b><span>Each unit you add to the length adds {formatVolume(volumePerUnit)} {unitLabel(unit, 3)} of volume.</span></div><span className="strip-records">{records.length} {records.length === 1 ? 'reading' : 'readings'}</span></div>
}

export default App
