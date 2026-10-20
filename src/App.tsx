import { useEffect, useRef, useState } from 'react'
import { Box, Grid3X3, Layers, Maximize2, Move3d, Pause, Play, RotateCcw } from 'lucide-react'
import Scene from './components/Scene'
import type { Dimensions, Unit } from './math'

type Construction = { length: number; width: number; layers: number }
const DEFAULT_CONSTRUCTION: Construction = { length: 5, width: 3, layers: 1 }

function unitPower(unit: Unit) {
  return unit === 'cm' ? 'cm³' : 'm³'
}

function Slider({
  axis,
  label,
  value,
  onChange,
}: {
  axis: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="axis-slider-field">
      <div className="axis-slider-label">
        <label htmlFor={`slider-${axis}`}>{label} <span>({axis})</span></label>
        <b>{value}</b>
      </div>
      <input
        id={`slider-${axis}`}
        className="axis-slider"
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        style={{ background: `linear-gradient(to right, #6694e7 0%, #6694e7 ${(value - 1) / 9 * 100}%, #e6ebf1 ${(value - 1) / 9 * 100}%, #e6ebf1 100%)` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="axis-slider-limits"><span>1 unit</span><span>10 units</span></div>
    </div>
  )
}

export default function App() {
  const [construction, setConstruction] = useState<Construction>(DEFAULT_CONSTRUCTION)
  const [unit, setUnit] = useState<Unit>('cm')
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(false)
  const [showUnitCubes, setShowUnitCubes] = useState(true)
  const [autoBuild, setAutoBuild] = useState(false)
  const [layersPerSecond, setLayersPerSecond] = useState(1)
  const [cameraKey, setCameraKey] = useState(0)
  const workspaceRef = useRef<HTMLDivElement>(null)

  const { length, width, layers } = construction
  const cubesPerLayer = length * width
  const totalCubes = cubesPerLayer * layers
  const dimensions: Dimensions = { side: length, length, width, height: layers, radius: 1 }

  useEffect(() => {
    if (!autoBuild) return
    if (layers >= 10) {
      setAutoBuild(false)
      return
    }
    const timer = window.setInterval(() => {
      setConstruction((current) => {
        return { ...current, layers: Math.min(10, current.layers + 1) }
      })
    }, 1000 / layersPerSecond)
    return () => window.clearInterval(timer)
  }, [autoBuild, layersPerSecond, layers])

  function changeDimension(axis: keyof Construction, value: number) {
    const nextValue = Math.max(1, Math.min(10, Math.round(value)))
    setAutoBuild(false)
    setConstruction((current) => axis === 'layers'
      ? { ...current, layers: nextValue }
      : { ...current, [axis]: nextValue, layers: 1 })
  }

  function reset() {
    setAutoBuild(false)
    setConstruction(DEFAULT_CONSTRUCTION)
    setUnit('cm')
    setShowGrid(true)
    setShowAxes(false)
    setShowUnitCubes(true)
    setCameraKey((current) => current + 1)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void workspaceRef.current?.requestFullscreen()
  }

  return (
    <div className="app-shell" ref={workspaceRef}>
      <header className="topbar">
        <div className="topbar-activity"><span className="activity-dot" />Fill with units</div>
        <div className="topbar-actions">
          <div className="unit-switch" aria-label="Volume unit">
            {(['cm', 'm'] as Unit[]).map((option) => (
              <button key={option} type="button" className={unit === option ? 'selected' : ''} aria-pressed={unit === option} onClick={() => setUnit(option)}>
                {option}
              </button>
            ))}
          </div>
          <button type="button" className="icon-button reset-top" onClick={reset} aria-label="Reset construction" title="Reset construction">
            <RotateCcw size={14} /><span>Reset</span>
          </button>
          <button type="button" className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Toggle fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      <div className="workspace fill-workspace">
        <main className="simulation-column">
          <section className="canvas-card">
            <div className="canvas-heading">
              <div>
                <span className="eyebrow">UNIT CUBE BUILDER</span>
                <h1>Build a cuboid</h1>
                <p>Construct the volume one layer at a time.</p>
              </div>
              <div className="drag-hint"><Move3d size={13} /> Drag to rotate</div>
            </div>

            <div className="viewport-wrap">
              <Scene
                shape="cuboid"
                dimensions={dimensions}
                fill
                showUnitCubes={showUnitCubes}
                cubeCount={totalCubes}
                showGrid={showGrid}
                showAxes={showAxes}
                cylinderApproximation={false}
                resetCameraKey={cameraKey}
                unitScale={1}
                unit={unit}
              />
              <div className="viewport-badges">
                <span className="live-badge"><i />LIVE BUILD</span>
                <span className="unit-badge"><span className="mini-cube" />1 {unit} cubes</span>
              </div>
              <div className="viewport-tools" aria-label="3D view options">
                <button className={`viewport-tool ${showGrid ? 'tool-on' : ''}`} type="button" onClick={() => setShowGrid((visible) => !visible)} aria-pressed={showGrid} title="Toggle grid"><Grid3X3 size={12} /> Grid</button>
                <span className="tool-divider" />
                <button className={`viewport-tool ${showAxes ? 'tool-on' : ''}`} type="button" onClick={() => setShowAxes((visible) => !visible)} aria-pressed={showAxes} title="Toggle axes"><Move3d size={12} /> Axes</button>
              </div>
              <div className="layer-indicator">
                <span className="layer-icon"><Layers size={15} /></span>
                <div><b>{layers} <small>/ 10 layers</small></b><span>{cubesPerLayer} cubes in each layer</span></div>
              </div>
            </div>
            <div className="viewport-footer">
              <span><Move3d size={11} /> Drag to rotate <span>·</span> Scroll to zoom</span>
              <span className="axis-key"><i className="key-x" />X <i className="key-y" />Y <i className="key-z" />Z</span>
            </div>
          </section>

          <section className="axis-builder-card" aria-labelledby="builder-title">
            <div className="builder-heading">
              <div><span className="eyebrow">UNIT-CUBE CONSTRUCTION</span><h2 id="builder-title">Set the dimensions</h2></div>
              <div className="builder-readout"><span>Current build</span><b>{length} × {width} × {layers}</b></div>
            </div>
            <div className="axis-slider-grid">
              <Slider axis="X" label="Length" value={length} onChange={(value) => changeDimension('length', value)} />
              <Slider axis="Y" label="Width" value={width} onChange={(value) => changeDimension('width', value)} />
              <Slider axis="Z" label="Layers" value={layers} onChange={(value) => changeDimension('layers', value)} />
            </div>
            <div className="builder-actions">
              <button className="builder-reset" type="button" onClick={reset}><RotateCcw size={12} /> Reset</button>
              <div className="playback-controls">
                <button className="playback-button" type="button" onClick={() => { setAutoBuild(false); changeDimension('layers', Math.min(10, layers + 1)) }} disabled={layers >= 10}>
                  <Layers size={12} /> Add layer
                </button>
                <button className="playback-button" type="button" onClick={() => setAutoBuild((playing) => !playing)} disabled={!autoBuild && layers >= 10}>
                  {autoBuild ? <Pause size={12} /> : <Play size={12} />}{autoBuild ? 'Pause' : 'Build'}
                </button>
                <label className="playback-rate">Speed
                  <select value={layersPerSecond} onChange={(event) => setLayersPerSecond(Number(event.target.value))} aria-label="Layer construction speed">
                    <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        </main>

        <aside className="sidebar sidebar-right">
          <div className="panel-title-row">
            <div><span className="eyebrow">LIVE SUMMARY</span><h2>Volume</h2></div>
            <span className="control-icon blue"><Box size={15} /></span>
          </div>
          <p className="controls-hint">Each small cube represents 1 {unit}³.</p>

          <section className="fill-card">
            <div className="fill-card-heading">
              <span className="control-icon blue"><Layers size={14} /></span>
              <div><h3>Construction progress</h3><p>Completed unit-cube layers</p></div>
            </div>
            <div className="layer-progress">
              <div className="layer-progress-top"><span>Layers built</span><b>{layers} <small>/ 10</small></b></div>
              <div className="progress-track"><i style={{ width: `${layers * 10}%` }} /></div>
            </div>
            <div className="unit-count-grid">
              <div><span>CUBES / LAYER</span><b>{cubesPerLayer}</b></div>
              <div><span>LAYERS</span><b>{layers}</b></div>
              <div><span>TOTAL CUBES</span><b>{totalCubes}</b></div>
            </div>
            <div className="fill-total"><span>Current volume</span><b>{totalCubes} {unitPower(unit)}<small>{length} × {width} × {layers} {unit}³</small></b></div>
            <button className={`toggle-row ${showUnitCubes ? 'toggle-on' : ''}`} type="button" onClick={() => setShowUnitCubes((visible) => !visible)} aria-pressed={showUnitCubes}>
              <span className="toggle-copy"><Box size={13} /> Show individual cubes</span><span className="switch"><i /></span>
            </button>
          </section>

          <section className="calculation-card" aria-label="Volume calculation">
            <div className="calc-heading"><span className="calc-symbol">V</span><div><span className="mini-label">CUBOID FORMULA</span><h3>Volume = Length × Width × Layers</h3></div></div>
            <div className="calc-dimensions"><span>Cubes per layer</span><b>{length} × {width} = {cubesPerLayer}</b></div>
            <div className="formula-block"><span className="mini-label">CALCULATION</span><div>{length} × {width} × {layers}</div></div>
            <div className="calc-result"><span>Volume</span><b>{totalCubes} <sup>{unitPower(unit)}</sup></b></div>
          </section>
        </aside>
      </div>
    </div>
  )
}
