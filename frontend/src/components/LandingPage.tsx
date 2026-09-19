import { Brain, MapPin, AlertTriangle, ArrowRight, Activity, Eye, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import GovtBadge from './GovtBadge';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative">
            {/* CyberText removed from landing — animated backgrounds undercut government portal credibility */}

            {/* Hero — full viewport */}
            <div className="relative z-10 h-screen w-full flex items-center justify-center">
                <div className="text-center p-8 bg-[#0a0a0f]/60 backdrop-blur-md rounded-2xl border border-white/[0.06] max-w-3xl mx-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="mb-6 flex justify-center"
                    >
                        <GovtBadge size={80} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                        <span className="text-sm font-medium text-[#94a3b8]">ATLAS — Advanced Threat Location & Alert System</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-[#64748b]"
                    >
                        ATLAS
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="max-w-2xl mx-auto text-lg text-[#94a3b8] mb-8 leading-relaxed"
                    >
                        Advanced Threat Location & Alert System.
                        Predict likely cash-withdrawal locations before withdrawal occurs.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="flex flex-wrap justify-center gap-4 mb-10"
                    >
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <Brain className="h-4 w-4 text-white" />
                            <span className="text-sm text-[#cbd5e1]">Risk Prediction</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <MapPin className="h-4 w-4 text-white" />
                            <span className="text-sm text-[#cbd5e1]">Location Intelligence</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <AlertTriangle className="h-4 w-4 text-white" />
                            <span className="text-sm text-[#cbd5e1]">Proactive Alerts</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.1, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-4 bg-white text-black font-semibold rounded-xl shadow-lg hover:bg-[#e4e4e7] transition-colors duration-300 flex items-center gap-2 mx-auto"
                        >
                            Access Investigator Console
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5, duration: 1 }}
                        className="mt-6 text-sm text-[#475569]"
                    >
                        Prototype &middot; Synthetic Data Only
                    </motion.p>
                </div>
            </div>

            {/* Content sections — scroll over the fixed background */}
            <section className="relative z-10 py-20 px-6 bg-[#0a0a0f]/80 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
                        <p className="text-[#94a3b8] max-w-2xl mx-auto">
                            This system assists law enforcement by analyzing complaints filed on the
                            National Cybercrime Portal and predicting likely cash-out locations before
                            withdrawal occurs.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<AlertTriangle className="h-6 w-6 text-white" />}
                            title="Complaint Received"
                            description="When a victim files a complaint on cybercrime.gov.in, the system automatically receives and begins processing the case data."
                        />
                        <FeatureCard
                            icon={<Brain className="h-6 w-6 text-white" />}
                            title="AI Risk Prediction"
                            description="Machine learning models analyze transaction patterns, account networks, and geographic signals to score withdrawal risk."
                        />
                        <FeatureCard
                            icon={<MapPin className="h-6 w-6 text-white" />}
                            title="Location Intelligence"
                            description="Ranked candidate ATM locations with confidence scores and expected time windows for investigator deployment."
                        />
                    </div>

                    <div className="mt-20">
                        <div className="bg-[#141414]/80 rounded-2xl border border-[#222]/50 p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-4">
                                        Investigation Workflow
                                    </h3>
                                    <div className="space-y-3">
                                        <PipelineStep icon={<AlertTriangle size={16} />} text="Victim Files Complaint on Govt Portal" />
                                        <PipelineStep icon={<Activity size={16} />} text="System Receives & Analyzes Transaction Signals" />
                                        <PipelineStep icon={<Brain size={16} />} text="Features Extracted & Risk Scored" />
                                        <PipelineStep icon={<MapPin size={16} />} text="Ranked ATM Locations Generated" />
                                        <PipelineStep icon={<Eye size={16} />} text="Investigator Receives Alert & Deploys" />
                                    </div>
                                </div>
                                <div className="bg-[#0a0a0f] rounded-xl p-6 border border-[#222]/30">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                                            <span className="text-base text-[#cbd5e1]">ATM-027, White Town</span>
                                            <span className="ml-auto text-base font-medium text-[#ef4444]">92%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                                            <span className="text-base text-[#cbd5e1]">ATM-014, MG Road</span>
                                            <span className="ml-auto text-base font-medium text-[#f59e0b]">78%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#d4d4d8]"></div>
                                            <span className="text-base text-[#cbd5e1]">ATM-031, Lawspet</span>
                                            <span className="ml-auto text-base font-medium text-[#d4d4d8]">64%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-20 text-center">
                        <h2 className="text-3xl font-bold text-white mb-4">Ready to Investigate?</h2>
                        <p className="text-[#94a3b8] max-w-xl mx-auto mb-8">
                            Access the Investigator Console to view live predictions, risk maps, and case management tools.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-3 bg-white text-black font-medium rounded-xl hover:bg-[#e4e4e7] transition-colors flex items-center gap-2"
                            >
                                Enter Investigator Console
                                <ArrowRight size={18} />
                            </button>
                            <a
                                href="https://cybercrime.gov.in"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-8 py-3 bg-white/5 text-white font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                                <ExternalLink size={18} />
                                File Complaint (Govt Portal)
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="relative z-10 py-8 px-6 border-t border-[#222]/30 bg-[#0a0a0f]/80 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <GovtBadge size={24} />
                        <span className="font-semibold text-white">ATLAS — Advanced Threat Location & Alert System</span>
                    </div>
                    <p className="text-base text-[#64748b]">
                        For Law Enforcement Use Only
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="bg-[#141414]/80 rounded-xl p-6 border border-[#222]/50 hover:border-[#444]/50 transition-colors"
        >
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-base text-[#94a3b8] leading-relaxed">{description}</p>
        </motion.div>
    );
}

function PipelineStep({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-3"
        >
            <div className="p-2 rounded-lg bg-white/5 text-white">
                {icon}
            </div>
            <span className="text-base text-[#cbd5e1]">{text}</span>
        </motion.div>
    );
}
