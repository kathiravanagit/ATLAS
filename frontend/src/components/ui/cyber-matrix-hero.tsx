import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Brain, MapPin, AlertTriangle } from 'lucide-react';

const CyberMatrixHero = () => {
    const navigate = useNavigate();
    const gridRef = useRef<HTMLDivElement>(null);
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
            tile.classList.add('tile');

            tile.onclick = e => {
                const target = e.target as HTMLElement;
                target.textContent = chars[Math.floor(Math.random() * chars.length)];
                target.classList.add('glitch');
                setTimeout(() => target.classList.remove('glitch'), 200);
            };

            return tile;
        }

        const createTiles = (quantity: number) => {
            Array.from(Array(quantity)).map((_, index) => {
                grid.appendChild(createTile(index));
            });
        }

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
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const radius = window.innerWidth / 4;

            for (const tile of grid.children) {
                const rect = (tile as HTMLElement).getBoundingClientRect();
                const tileX = rect.left + rect.width / 2;
                const tileY = rect.top + rect.height / 2;

                const distance = Math.sqrt(
                    Math.pow(mouseX - tileX, 2) + Math.pow(mouseY - tileY, 2)
                );

                const intensity = Math.max(0, 1 - distance / radius);

                (tile as HTMLElement).style.setProperty('--intensity', String(intensity));
            }
        };

        window.addEventListener('resize', createGrid);
        window.addEventListener('mousemove', handleMouseMove);

        createGrid();

        return () => {
            window.removeEventListener('resize', createGrid);
            window.removeEventListener('mousemove', handleMouseMove);
        };

    }, [isClient]);

    const fadeUpVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: i * 0.2 + 0.5,
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94] as const,
            },
        }),
    };

    return (
        <div className="relative h-screen w-full bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden">
            <div ref={gridRef} id="tiles"></div>

            <style>{`
                #tiles {
                    --intensity: 0;
                    display: grid;
                    grid-template-columns: repeat(var(--columns), 1fr);
                    grid-template-rows: repeat(var(--rows), 1fr);
                    width: 100vw;
                    height: 100vh;
                    position: absolute;
                    top: 0;
                    left: 0;
                }
                .tile {
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 1.2rem;
                    opacity: calc(0.05 + var(--intensity) * 0.6);
                    color: rgba(255, 255, 255, calc(0.3 + var(--intensity) * 0.7));
                    text-shadow: 0 0 calc(var(--intensity) * 10px) rgba(255, 255, 255, 0.5);
                    transform: scale(calc(1 + var(--intensity) * 0.2));
                    transition: color 0.2s ease, text-shadow 0.2s ease, transform 0.2s ease;
                }
                .tile.glitch {
                    animation: glitch-anim 0.2s ease;
                }
                @keyframes glitch-anim {
                    0% { transform: scale(1); color: rgba(255,255,255,0.8); }
                    50% { transform: scale(1.2); color: #fff; text-shadow: 0 0 10px #fff; }
                    100% { transform: scale(1); color: rgba(255,255,255,0.8); }
                }
            `}</style>

            <div className="relative z-10 text-center p-8 bg-[#0a0a0f]/80 backdrop-blur-md rounded-2xl border border-[#222]/50 max-w-3xl mx-4">
                <motion.div
                    custom={0}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
                >
                    <Shield className="h-4 w-4 text-white" />
                        <span className="text-base font-medium text-[#94a3b8]">
                            ATLAS — Advanced Threat Location & Alert System
                        </span>
                </motion.div>

                <motion.h1
                    custom={1}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-[#64748b]"
                >
                    ATLAS
                </motion.h1>

                <motion.p
                    custom={2}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-2xl mx-auto text-lg text-[#94a3b8] mb-8 leading-relaxed"
                >
                    Advanced Threat Location & Alert System.
                    Predict likely cash-withdrawal locations before withdrawal occurs.
                </motion.p>

                <motion.div
                    custom={3}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-wrap justify-center gap-4 mb-10"
                >
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                        <Brain className="h-4 w-4 text-white" />
                        <span className="text-base text-[#cbd5e1]">Risk Prediction</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                        <MapPin className="h-4 w-4 text-white" />
                        <span className="text-base text-[#cbd5e1]">Location Intelligence</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                        <AlertTriangle className="h-4 w-4 text-white" />
                        <span className="text-base text-[#cbd5e1]">Proactive Alerts</span>
                    </div>
                </motion.div>

                <motion.div
                    custom={4}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <button 
                        onClick={() => navigate('/login')}
                        className="px-8 py-4 bg-white text-black font-semibold rounded-xl shadow-lg hover:bg-gray-200 transition-colors duration-300 flex items-center gap-2 mx-auto"
                    >
                        Access Investigator Console
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </motion.div>

                <motion.p
                    custom={5}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="mt-6 text-sm text-[#475569]"
                >
                    Prototype • Synthetic Data Only
                </motion.p>
            </div>
        </div>
    );
};

export default CyberMatrixHero;
