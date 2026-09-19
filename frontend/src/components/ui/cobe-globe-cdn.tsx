"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import createGlobe from "cobe"

interface CdnMarker {
  id: string
  location: [number, number]
  region: string
}

interface CdnArc {
  id: string
  from: [number, number]
  to: [number, number]
}

interface GlobeCdnProps {
  markers?: CdnMarker[]
  arcs?: CdnArc[]
  className?: string
  speed?: number
}

const defaultMarkers: CdnMarker[] = [
  { id: "cdn-iad", location: [38.95, -77.45], region: "iad1" },
  { id: "cdn-sfo", location: [37.62, -122.38], region: "sfo1" },
  { id: "cdn-cdg", location: [49.01, 2.55], region: "cdg1" },
  { id: "cdn-hnd", location: [35.55, 139.78], region: "hnd1" },
  { id: "cdn-syd", location: [-33.95, 151.18], region: "syd1" },
  { id: "cdn-gru", location: [-23.43, -46.47], region: "gru1" },
  { id: "cdn-sin", location: [1.36, 103.99], region: "sin1" },
  { id: "cdn-arn", location: [59.65, 17.93], region: "arn1" },
  { id: "cdn-dub", location: [53.43, -6.25], region: "dub1" },
  { id: "cdn-bom", location: [19.09, 72.87], region: "bom1" },
]

const defaultArcs: CdnArc[] = [
  { id: "cdn-arc-1", from: [38.95, -77.45], to: [49.01, 2.55] },
  { id: "cdn-arc-2", from: [37.62, -122.38], to: [35.55, 139.78] },
  { id: "cdn-arc-3", from: [49.01, 2.55], to: [1.36, 103.99] },
  { id: "cdn-arc-4", from: [38.95, -77.45], to: [-23.43, -46.47] },
  { id: "cdn-arc-5", from: [35.55, 139.78], to: [-33.95, 151.18] },
  { id: "cdn-arc-6", from: [49.01, 2.55], to: [19.09, 72.87] },
]

export function GlobeCdn({
  markers = defaultMarkers,
  arcs = defaultArcs,
  className = "",
  speed = 0.003,
}: GlobeCdnProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)
  const animFrameRef = useRef<number>(0)
  const [traffic, setTraffic] = useState(() =>
    defaultArcs.map((a, i) => ({ id: a.id, value: [420, 380, 290, 185, 156, 134][i] || 100 }))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTraffic((data) =>
        data.map((t) => ({
          ...t,
          value: Math.max(50, t.value + Math.floor(Math.random() * 21) - 10),
        }))
      )
    }, 250)
    return () => clearInterval(interval)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
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
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let phi = 0
    let destroyed = false

    function initGlobe() {
      if (destroyed || !canvas) return

      const width = canvas.clientWidth || 400
      const height = canvas.clientHeight || 400

      if (width === 0 || height === 0) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr

      const globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width,
        height,
        phi: 0,
        theta: 0.15,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 8,
        baseColor: [0.08, 0.08, 0.1],
        markerColor: [0.9, 0.9, 0.9],
        glowColor: [0.12, 0.12, 0.15],
        markerElevation: 0.03,
        markers: markers.map((m) => ({ location: m.location, size: 0.015, id: m.id })),
        arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        arcColor: [0.5, 0.5, 0.55],
        arcWidth: 0.5,
        arcHeight: 0.25,
        opacity: 0.85,
      })

      globeRef.current = globe
      canvas.style.opacity = "1"

      function animate() {
        if (destroyed) return
        if (!isPausedRef.current) phi += speed
        globe.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.15 + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animFrameRef.current = requestAnimationFrame(animate)
      }
      animate()
    }

    canvas.style.opacity = "0"

    if (canvas.clientWidth > 0) {
      initGlobe()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          initGlobe()
        }
      })
      ro.observe(canvas)

      return () => {
        ro.disconnect()
        destroyed = true
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        if (globeRef.current) {
          globeRef.current.destroy()
          globeRef.current = null
        }
      }
    }

    return () => {
      destroyed = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (globeRef.current) {
        globeRef.current.destroy()
        globeRef.current = null
      }
    }
  }, [markers, arcs, speed])

  const pyramidFaceStyle = (nth: number): React.CSSProperties => {
    const transforms = [
      "rotateY(0deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(120deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(240deg) translateZ(4px) rotateX(19.5deg)",
      "rotateX(-90deg) rotateZ(60deg) translateY(4px)",
    ]
    const colors = ["#e0e0e0", "#c0c0c0", "#a0a0a0", "#b0b0b0"]
    return {
      position: "absolute", left: -0.5, top: 0,
      width: 0, height: 0,
      borderLeft: "6.5px solid transparent",
      borderRight: "6.5px solid transparent",
      borderBottom: `13px solid ${colors[nth]}`,
      transformOrigin: "center bottom",
      transform: transforms[nth],
    }
  }

  return (
    <div className={`relative select-none ${className}`} ref={containerRef} style={{ aspectRatio: "1 / 1", width: "100%" }}>
      <style>{`
        @keyframes pyramid-spin {
          0% { transform: rotateX(20deg) rotateY(0deg); }
          100% { transform: rotateX(20deg) rotateY(360deg); }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%", height: "100%", cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none",
          background: "transparent",
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            positionAnchor: `--cobe-${m.id}` as any,
            bottom: "anchor(top)",
            left: "anchor(center)",
            translate: "-50% 0",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 6,
            pointerEvents: "none" as const,
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            transition: "opacity 0.3s, filter 0.3s",
          }}
        >
          <div style={{
            width: 12, height: 12, position: "relative",
            transformStyle: "preserve-3d" as const,
            animation: "pyramid-spin 4s linear infinite",
          }}>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} style={pyramidFaceStyle(n)} />
            ))}
          </div>
          <span style={{
            fontFamily: "monospace", fontSize: "0.55rem", color: "#fff",
            background: "rgba(255,255,255,0.12)", padding: "2px 6px", borderRadius: 3,
            letterSpacing: "0.05em", whiteSpace: "nowrap" as const,
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
          }}>{m.region}</span>
        </div>
      ))}
      {traffic.map((t) => (
        <div
          key={t.id}
          style={{
            position: "absolute",
            positionAnchor: `--cobe-arc-${t.id}` as any,
            bottom: "anchor(top)",
            left: "anchor(center)",
            translate: "-50% 0",
            fontFamily: "monospace",
            fontSize: "0.5rem",
            color: "#fff",
            background: "rgba(255,255,255,0.08)",
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap" as const,
            pointerEvents: "none" as const,
            opacity: `var(--cobe-visible-arc-${t.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-arc-${t.id}, 0)) * 8px))`,
            transition: "opacity 0.3s, filter 0.3s",
            backdropFilter: "blur(4px)",
          }}
        >
          {t.value}k req/s
        </div>
      ))}
    </div>
  )
}
