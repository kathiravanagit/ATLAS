import { useEffect, useRef, useState } from "react"
import createGlobe from "cobe"

interface AtmPoint {
  id: string
  lat: number
  lng: number
  risk: number
  name: string
}

interface JarvisGlobeProps {
  atms: AtmPoint[]
  onAtmClick?: (atm: AtmPoint) => void
  className?: string
}

export default function JarvisGlobe({ atms, onAtmClick, className = "" }: JarvisGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)
  const animFrameRef = useRef<number>(0)
  const [activeAtm, setActiveAtm] = useState<AtmPoint | null>(null)
  const [scanLine, setScanLine] = useState(0)
  const [zoomPhase, setZoomPhase] = useState<"scanning" | "locked" | "ready">("scanning")

  // Find highest risk ATM for center
  const highestRisk = atms.reduce((max, atm) => atm.risk > max.risk ? atm : max, atms[0])
  const centerLat = highestRisk?.lat || 11.9416
  const centerLng = highestRisk?.lng || 79.8083

  const markers = atms.map(atm => ({
    location: [atm.lat * Math.PI / 180, atm.lng * Math.PI / 180] as [number, number],
    size: 0.015 + (atm.risk / 100) * 0.035,
    color: atm.risk > 70 ? [1, 0.27, 0.27] : atm.risk > 45 ? [0.96, 0.62, 0.04] : [0.44, 0.44, 0.44],
  }))

  // Arcs from center to each ATM
  const arcs = atms.map(atm => ({
    from: [centerLat * Math.PI / 180, centerLng * Math.PI / 180] as [number, number],
    to: [atm.lat * Math.PI / 180, atm.lng * Math.PI / 180] as [number, number],
  }))

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 1) % 100)
    }, 40)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Scanning animation
    setTimeout(() => setZoomPhase("locked"), 1500)
    setTimeout(() => setZoomPhase("ready"), 2500)
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", () => {
      if (pointerInteracting.current !== null) {
        phiOffsetRef.current += dragOffset.current.phi
        thetaOffsetRef.current += dragOffset.current.theta
        dragOffset.current = { phi: 0, theta: 0 }
      }
      pointerInteracting.current = null
      isPausedRef.current = false
    }, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let phi = 0
    let destroyed = false

    const width = canvas.clientWidth || 400
    const height = canvas.clientHeight || 400
    if (width === 0 || height === 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr

    // Calculate theta to center on Puducherry/Highest risk
    const targetTheta = (centerLat / 90) * 0.5

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width,
      height,
      phi: 0,
      theta: targetTheta,
      dark: 1,
      diffuse: 1.5,
      mapSamples: 24000,
      mapBrightness: 12,
      baseColor: [0.03, 0.03, 0.06],
      markerColor: [1, 1, 1],
      glowColor: [0.08, 0.15, 0.35],
      markerElevation: 0.05,
      markers: markers.map(m => ({ location: m.location, size: m.size, id: JSON.stringify(m.location) })),
      arcs: arcs.map(a => ({ from: a.from, to: a.to, id: JSON.stringify(a.from) })),
      arcColor: [0.15, 0.4, 0.9] as [number, number, number],
      arcWidth: 0.5,
      arcHeight: 0.25,
      opacity: 0.95,
    })

    globeRef.current = globe
    canvas.style.opacity = "1"

    function animate() {
      if (destroyed) return
      if (!isPausedRef.current) phi += 0.0015
      globe.update({
        phi: phi + phiOffsetRef.current + dragOffset.current.phi,
        theta: targetTheta + thetaOffsetRef.current + dragOffset.current.theta,
      })
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      destroyed = true
      cancelAnimationFrame(animFrameRef.current)
      globe.destroy()
    }
  }, [atms])

  const highestRiskAtm = atms.reduce((max, atm) => atm.risk > max.risk ? atm : max, atms[0])

  return (
    <div className={`relative ${className}`}>
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-10">
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/60 to-transparent"
          style={{ top: `${scanLine}%`, transition: 'top 0.04s linear' }}
        />
        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[#3b82f6]/50" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-[#3b82f6]/50" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-[#3b82f6]/50" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-[#3b82f6]/50" />
      </div>

      {/* Globe */}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = { x: e.clientX, y: e.clientY }
          isPausedRef.current = true
        }}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.5s ease",
          touchAction: "none",
        }}
      />

      {/* HUD Top Left */}
      <div className="absolute top-3 left-3 z-20">
        <div className="text-[10px] text-[#3b82f6] font-mono tracking-wider flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${zoomPhase === "ready" ? "bg-[#22c55e] animate-pulse" : "bg-[#f59e0b] animate-pulse"}`} />
          {zoomPhase === "scanning" ? "SCANNING..." : zoomPhase === "locked" ? "TARGET LOCKED" : "TACTICAL MAP"}
        </div>
        <div className="text-[11px] text-[#d4d4d8] font-mono mt-0.5">
          {centerLat.toFixed(4)}N {centerLng.toFixed(4)}E
        </div>
      </div>

      {/* HUD Bottom Left - Target Info */}
      <div className="absolute bottom-3 left-3 z-20">
        <div className="text-[11px] text-[#d4d4d8] font-mono">
          {atms.length} TARGETS DETECTED
        </div>
        {highestRiskAtm && (
          <div className="text-[10px] text-[#ef4444] font-mono mt-0.5 animate-pulse">
            HIGHEST RISK: {highestRiskAtm.id} ({highestRiskAtm.risk}%)
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-[8px] text-[#d4d4d8]">HIGH</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="text-[8px] text-[#d4d4d8]">MED</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#d4d4d8]" />
            <span className="text-[8px] text-[#d4d4d8]">LOW</span>
          </div>
        </div>
      </div>

      {/* HUD Top Right */}
      <div className="absolute top-3 right-3 z-20 text-right">
        <div className="text-[8px] text-[#d4d4d8] font-mono">LIVE TRACKING</div>
        <div className="text-[11px] text-[#22c55e] font-mono flex items-center gap-1 justify-end">
          <span className="w-1 h-1 rounded-full bg-[#22c55e] animate-pulse" />
          ACTIVE
        </div>
      </div>
    </div>
  )
}
