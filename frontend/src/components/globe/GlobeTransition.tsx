import { useRef, useEffect } from 'react';
import { PredictionLocation } from '../../types';
import { LAND_B64, MW, MH } from './landData';

const MAX_DPR = 2;

function clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function parseRGB(input: string | undefined, fb: [number, number, number]): [number, number, number] {
  if (!input) return fb;
  const str = String(input).trim();
  if (str.charAt(0) === '#') {
    let hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
    return fb;
  }
  const m = str.match(/[\d.]+/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return fb;
}

interface GlobeTransitionProps {
  locations: PredictionLocation[];
  onComplete: () => void;
}

export default function GlobeTransition({ locations, onComplete }: GlobeTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let land: Uint8Array | null = null;
    try {
      const bin = atob(LAND_B64);
      land = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) land[i] = bin.charCodeAt(i);
    } catch { land = null; }

    const isLand = (lon: number, lat: number) => {
      if (!land) return false;
      const gx = Math.floor(((lon + 180) / 360) * MW);
      const gy = Math.floor(((90 - lat) / 180) * MH);
      if (gx < 0 || gx >= MW || gy < 0 || gy >= MH) return false;
      const b = gy * MW + gx;
      return ((land[b >> 3] >> (b & 7)) & 1) === 1;
    };

    const nodes: { lat: number; lon: number; land: boolean }[] = [];
    const step = 3.05 / 1.2;
    for (let lat = -86; lat <= 86; lat += step) {
      const rl = Math.cos((lat * Math.PI) / 180);
      const n = Math.max(1, Math.round(98 * 1.2 * rl));
      for (let i = 0; i < n; i++) {
        const lon = -180 + (360 * i) / n;
        nodes.push({ lat: (lat * Math.PI) / 180, lon: (lon * Math.PI) / 180, land: isLand(lon, lat) });
      }
    }

    const ink = parseRGB('#a1a1aa', [161, 161, 170]);
    const rgb = ink[0] + ',' + ink[1] + ',' + ink[2];
    const tone = (a: number) => 'rgba(' + rgb + ',' + clampN(a, 0, 1).toFixed(3) + ')';

    const pinColor = (score: number): [number, number, number] => {
      if (score > 70) return [239, 68, 68];
      if (score > 45) return [245, 158, 11];
      return [59, 130, 246];
    };

    const GLOBE_DURATION = 1800;
    const MORPH_DURATION = 1000;
    const FADE_DURATION = 500;
    const TOTAL = GLOBE_DURATION + MORPH_DURATION + FADE_DURATION;

    let raf = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed > TOTAL + 200) {
        onCompleteRef.current();
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = canvas.clientWidth || 1200;
      const ch = canvas.clientHeight || 800;
      const bw = Math.max(1, Math.round(cw * dpr));
      const bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, cw, ch);

      const u = Math.min(cw, ch);
      const cx = cw / 2;
      const cy = ch / 2;

      const morphProgress = elapsed > GLOBE_DURATION
        ? clampN((elapsed - GLOBE_DURATION) / MORPH_DURATION, 0, 1)
        : 0;

      const fadeAlpha = elapsed > GLOBE_DURATION + MORPH_DURATION
        ? clampN(1 - (elapsed - GLOBE_DURATION - MORPH_DURATION) / FADE_DURATION, 0, 1)
        : 1;

      const spin = 2.1 + (elapsed / 1000) * 0.35;
      const tiltBase = -0.36;
      const flatten = morphProgress;
      const R = u * 0.318 * (1 - flatten * 0.15);
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const tilt = tiltBase * (1 - flatten * 0.5);
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);

      const flatW = cw * 0.42;
      const flatH = ch * 0.38;

      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const cl = Math.cos(nd.lat);
        const x0 = cl * Math.cos(nd.lon);
        const y0 = Math.sin(nd.lat);
        const z0 = cl * Math.sin(nd.lon);
        const x1 = x0 * cs - z0 * sn;
        const z1 = x0 * sn + z0 * cs;
        const y2 = y0 * ct - z1 * st;
        const z2 = y0 * st + z1 * ct;

        let px: number;
        let py: number;
        let alpha: number;

        if (flatten > 0) {
          const flatX = nd.lon / Math.PI;
          const flatY = nd.lat / (Math.PI / 2);
          const globeX = cx + x1 * R;
          const globeY = cy - y2 * R;
          const targetX = cx + flatX * flatW;
          const targetY = cy + flatY * flatH;
          px = globeX + (targetX - globeX) * flatten;
          py = globeY + (targetY - globeY) * flatten;
          alpha = (0.15 + 0.45) * fadeAlpha;
        } else {
          if (z2 <= 0.02) continue;
          px = cx + x1 * R;
          py = cy - y2 * R;
          alpha = (0.15 + z2 * 0.45) * fadeAlpha;
        }

        const sz = nd.land ? (u * 0.0035 * (0.6 + 0.4)) : (u * 0.002 * (0.4 + 0.3));
        ctx.fillStyle = tone(alpha);
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }

      const locs = locationsRef.current;
      for (let li = 0; li < locs.length; li++) {
        const loc = locs[li];
        const plat = (loc.latitude * Math.PI) / 180;
        const plon = (loc.longitude * Math.PI) / 180;
        const pcl = Math.cos(plat);
        const ax = pcl * Math.cos(plon);
        const ay = Math.sin(plat);
        const az = pcl * Math.sin(plon);
        const bx1 = ax * cs - az * sn;
        const bz1 = ax * sn + az * cs;
        const by2 = ay * ct - bz1 * st;
        const bz2 = ay * st + bz1 * ct;

        let ppx: number;
        let ppy: number;

        if (flatten > 0) {
          const flatX = plon / Math.PI;
          const flatY = plat / (Math.PI / 2);
          const globeX = cx + bx1 * R;
          const globeY = cy - by2 * R;
          const targetX = cx + flatX * flatW;
          const targetY = cy + flatY * flatH;
          ppx = globeX + (targetX - globeX) * flatten;
          ppy = globeY + (targetY - globeY) * flatten;
        } else {
          if (bz2 <= 0.02) continue;
          ppx = cx + bx1 * R;
          ppy = cy - by2 * R;
        }

        const col = pinColor(loc.risk_score);
        const pinAlpha = (0.7 + (flatten > 0 ? 0.3 : bz2 * 0.3)) * fadeAlpha;
        const staggerDelay = li * 120;
        const popIn = clampN((elapsed - staggerDelay) / 500, 0, 1);
        const eased = 1 - Math.pow(1 - popIn, 3);
        const pinR = u * 0.014 * eased;

        if (pinR < 0.5) continue;

        const grd = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, pinR * 3.5);
        grd.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (pinAlpha * 0.3).toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(ppx, ppy, pinR * 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + pinAlpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(ppx, ppy, pinR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,' + (pinAlpha * 0.85).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(ppx, ppy, pinR * 0.3, 0, Math.PI * 2);
        ctx.fill();

        const pulseAge = (elapsed - staggerDelay) / 1000;
        if (pulseAge > 0.1 && pulseAge < 2) {
          const t = (pulseAge - 0.1) / 1.9;
          const pulseR = pinR * (1 + t * 3);
          const pulseA = (1 - t) * pinAlpha * 0.4;
          ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + pulseA.toFixed(3) + ')';
          ctx.lineWidth = Math.max(0.7, u * 0.0015);
          ctx.beginPath();
          ctx.arc(ppx, ppy, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (fadeAlpha > 0.3) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const titleAlpha = fadeAlpha * 0.9;
        ctx.font = 'bold ' + (u * 0.024).toFixed(1) + 'px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,' + titleAlpha.toFixed(3) + ')';
        ctx.fillText('ATLAS', cx, cy - u * 0.01);

        ctx.font = (u * 0.011).toFixed(1) + 'px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(161,161,170,' + (titleAlpha * 0.7).toFixed(3) + ')';
        ctx.fillText('Scanning ' + locs.length + ' threat locations across the globe', cx, cy + u * 0.025);

        const barW = u * 0.18;
        const barH = 2;
        const barX = cx - barW / 2;
        const barY = cy + u * 0.05;
        const progress = clampN(elapsed / (GLOBE_DURATION + MORPH_DURATION), 0, 1);

        ctx.fillStyle = 'rgba(39,39,42,' + fadeAlpha.toFixed(3) + ')';
        ctx.fillRect(barX, barY, barW, barH);

        const gradient = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
        gradient.addColorStop(0, 'rgba(59,130,246,' + fadeAlpha.toFixed(3) + ')');
        gradient.addColorStop(1, 'rgba(168,85,247,' + fadeAlpha.toFixed(3) + ')');
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barW * progress, barH);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="absolute inset-0 z-[9999]"
      style={{ background: '#0a0a0f' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
}
