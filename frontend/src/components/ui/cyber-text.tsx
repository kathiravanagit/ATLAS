import { useEffect, useRef, useState } from 'react';

interface CyberTextProps {
  density?: 'bold' | 'light';
  baseGlow?: number;
  className?: string;
}

export default function CyberText({ density = 'bold', baseGlow = 0, className = '' }: CyberTextProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const styleId = useRef(`cyber-text-${Math.random().toString(36).slice(2, 8)}`);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !gridRef.current) return;

    const grid = gridRef.current;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>/?;:"[]{}\\|!@#$%^&*()_+-=';
    let columns = 0;
    let rows = 0;

    const createTile = (index: number) => {
      const tile = document.createElement('div');
      tile.classList.add('cyber-char');
      tile.onclick = e => {
        const target = e.target as HTMLElement;
        target.textContent = chars[Math.floor(Math.random() * chars.length)];
        target.classList.add('glitch');
        setTimeout(() => target.classList.remove('glitch'), 200);
      };
      return tile;
    };

    const createTiles = (quantity: number) => {
      Array.from(Array(quantity)).forEach((_, index) => {
        grid.appendChild(createTile(index));
      });
    };

    const createGrid = () => {
      grid.innerHTML = '';
      const size = 60;
      columns = Math.floor(window.innerWidth / size);
      rows = Math.floor(window.innerHeight / size);
      grid.style.setProperty('--columns', String(columns));
      grid.style.setProperty('--rows', String(rows));
      createTiles(columns * rows);
      for (const tile of grid.children) {
        (tile as HTMLElement).textContent = chars[Math.floor(Math.random() * chars.length)];
        (tile as HTMLElement).style.setProperty('--intensity', String(baseGlow));
      }
    };

    let animFrame: number;
    let mouseX = -9999;
    let mouseY = -9999;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const updateGlow = () => {
      const radius = 250;
      for (const tile of grid.children) {
        const el = tile as HTMLElement;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(mouseX - cx, mouseY - cy);
        const intensity = dist < radius ? Math.max(baseGlow, 1 - dist / radius) : baseGlow;
        el.style.setProperty('--intensity', String(intensity));
      }
      animFrame = requestAnimationFrame(updateGlow);
    };

    window.addEventListener('resize', createGrid);
    window.addEventListener('mousemove', handleMouseMove);
    createGrid();
    animFrame = requestAnimationFrame(updateGlow);

    return () => {
      window.removeEventListener('resize', createGrid);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrame);
    };
  }, [isClient, baseGlow]);

  const isBold = density === 'bold';
  const id = styleId.current;

  return (
    <>
      <div ref={gridRef} id={id} className={`fixed inset-0 w-screen h-screen overflow-hidden ${className}`} />
      <style>{`
        #${id} {
          display: grid;
          grid-template-columns: repeat(var(--columns), 1fr);
          grid-template-rows: repeat(var(--rows), 1fr);
          width: 100vw;
          height: 100vh;
        }
        #${id} .cyber-char {
          position: relative;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Courier New', Courier, monospace;
          font-size: 1.2rem;
          opacity: calc(${isBold ? '0.03 + var(--intensity) * 0.50' : '0.015 + var(--intensity) * 0.12'});
          color: rgba(255, 255, 255, ${isBold ? 'calc(0.12 + var(--intensity) * 0.70)' : 'calc(0.08 + var(--intensity) * 0.2)'});
          text-shadow: 0 0 calc(var(--intensity) * ${isBold ? '12px' : '3px'}) rgba(255, 255, 255, ${isBold ? '0.5' : '0.08'}), 0 0 calc(var(--intensity) * ${isBold ? '24px' : '0px'}) rgba(59, 130, 246, ${isBold ? '0.3' : '0'});
          transform: scale(calc(1 + var(--intensity) * ${isBold ? '0.1' : '0.05'}));
          transition: color 0.3s ease, text-shadow 0.3s ease, transform 0.3s ease;
        }
        #${id} .cyber-char.glitch {
          animation: cyber-glitch-${id} ${isBold ? '0.2s' : '0.15s'} ease;
        }
        @keyframes cyber-glitch-${id} {
          0% { transform: scale(1); color: rgba(255,255,255,${isBold ? '0.4' : '0.2'}); }
          50% { transform: scale(1.1); color: rgba(255,255,255,${isBold ? '0.6' : '0.3'}); text-shadow: 0 0 6px rgba(255,255,255,0.3); }
          100% { transform: scale(1); color: rgba(255,255,255,${isBold ? '0.4' : '0.2'}); }
        }
      `}</style>
    </>
  );
}
