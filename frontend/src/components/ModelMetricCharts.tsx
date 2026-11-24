import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { count, formatMetric, isMeasured, percent, ratio, validMatrix, type ConfusionMatrix, type ModelMetrics, type Scores } from '../lib/metrics';

export function ScoreGrid({ scores, roc, pr }: { scores?: Scores | null; roc?: number | null; pr?: number | null }) {
  const values = [
    ['Accuracy', percent(scores?.accuracy)], ['Precision', percent(scores?.precision)],
    ['Recall', percent(scores?.recall)], ['F1 Score', percent(scores?.f1_score)],
    ['ROC AUC', formatMetric(roc, 3)], ['PR-AUC', formatMetric(pr, 3)],
  ];
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{values.map(([label, value]) => <div key={label} className="bg-[#F6F6F3] rounded-lg p-3 border border-[#D2D1CA] text-center">
    <div className="text-xs text-[#43474C] mb-1">{label}</div><div className="text-[15px] font-semibold text-[#1A1C1F]">{value}</div>
  </div>)}</div>;
}

export function ConfusionMatrixChart({ matrix }: { matrix?: ConfusionMatrix | null }) {
  if (!validMatrix(matrix)) return <p className="text-sm text-[#43474C]">Confusion matrix: Unavailable — no verified evaluation counts supplied.</p>;
  return <section aria-label="Confusion matrix"><h4 className="text-sm font-medium mb-2">Confusion Matrix (n={count(matrix.tp + matrix.fp + matrix.fn + matrix.tn)})</h4>
    <div className="grid grid-cols-2 gap-2 max-w-sm">{[['True Positive', matrix.tp], ['False Positive', matrix.fp], ['False Negative', matrix.fn], ['True Negative', matrix.tn]].map(([label, value]) => <div key={label} className="rounded border border-gray-300 bg-[#F6F6F3] p-3 text-center"><div className="text-xs text-[#43474C]">{label}</div><div className="text-[15px] font-semibold">{value}</div></div>)}</div>
    <p className="mt-2 text-sm text-[#43474C]">False negative rate: {percent(ratio(matrix.fn, matrix.tp + matrix.fn), true)} · False positive rate: {percent(ratio(matrix.fp, matrix.fp + matrix.tn), true)}</p>
  </section>;
}

export function ComparisonBars({ rows }: { rows: { name: string; accuracy?: number | null }[] }) {
  return <section aria-label="Model comparison" className="space-y-3"><h4 className="text-sm font-medium">Model Comparison — accuracy</h4>{rows.map(row => <div key={row.name} className="flex flex-wrap items-center gap-3 text-sm">
    <span className="w-44 text-[#43474C]">{row.name}</span>
    {isMeasured(row.accuracy) && <div className="flex-1 min-w-12 h-3 bg-[#EFEFEA] rounded"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, row.accuracy))}%` }} className="h-full bg-blue-700 rounded" /></div>}
    <span className="font-mono">{percent(row.accuracy)}</span>
  </div>)}</section>;
}

export function RocChart({ curve }: { curve?: ModelMetrics['roc_curve'] }) {
  const valid = curve && Array.isArray(curve.fpr) && Array.isArray(curve.tpr) && curve.fpr.length > 1 && curve.fpr.length === curve.tpr.length
    && [...curve.fpr, ...curve.tpr].every(n => isMeasured(n) && n >= 0 && n <= 1);
  if (!valid) return <p className="text-sm text-[#43474C]">ROC curve: Unavailable — no evaluation points supplied.</p>;
  const points = curve.fpr.map((fpr, i) => ({ fpr, tpr: curve.tpr[i] }));
  return <section aria-label="ROC curve"><h4 className="text-sm font-medium mb-2">ROC Curve — supplied evaluation points</h4><div className="h-56 w-full" data-testid="roc-chart"><ResponsiveContainer width="100%" height="100%">
    <LineChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fpr" type="number" domain={[0, 1]} /><YAxis domain={[0, 1]} /><Tooltip /><Line dataKey="tpr" type="linear" stroke="#17406F" dot={false} isAnimationActive={false} /></LineChart>
  </ResponsiveContainer></div></section>;
}
