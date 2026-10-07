export type Metric = number | null | undefined;
export const UNAVAILABLE = 'Unavailable';
export function isMeasured(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
export function formatMetric(value: Metric, digits = 1, suffix = '') {
  return isMeasured(value) ? `${value.toFixed(digits)}${suffix}` : UNAVAILABLE;
}
export function percent(value: Metric, fraction = false) {
  return isMeasured(value) ? formatMetric(value * (fraction ? 100 : 1), 1, '%') : UNAVAILABLE;
}
export function count(value: Metric) {
  return isMeasured(value) ? value.toLocaleString('en-IN') : UNAVAILABLE;
}
export function ratio(numerator: Metric, denominator: Metric): Metric {
  return isMeasured(numerator) && isMeasured(denominator) && denominator > 0 ? numerator / denominator : null;
}
export function scaled(value: Metric, factor: number): Metric {
  return isMeasured(value) ? value * factor : null;
}
export type ConfusionMatrix = { tp: number; fp: number; fn: number; tn: number };
export function validMatrix(value: unknown): value is ConfusionMatrix {
  if (!value || typeof value !== 'object') return false;
  const cells = value as ConfusionMatrix;
  return [cells.tp, cells.fp, cells.fn, cells.tn].every(n => isMeasured(n) && n >= 0 && Number.isInteger(n));
}
export interface Scores {
  accuracy?: Metric; precision?: Metric; recall?: Metric; f1_score?: Metric;
  confusion_matrix?: ConfusionMatrix | null;
}
export interface ModelMetrics {
  ensemble?: Scores | null; random_forest?: Scores | null; xgboost?: Scores | null;
  roc_auc?: Metric; pr_auc?: Metric; cv_accuracy?: Metric; cv_std?: Metric;
  training_date?: string | null; n_samples?: Metric; n_features?: Metric;
  cities?: Metric; atms?: Metric; data_source?: string | null;
  roc_curve?: { fpr: number[]; tpr: number[] } | null;
}
export interface ModelCard extends Scores {
  model_type?: string | null; model_version?: string | null;
  pr_auc?: Metric; roc_auc?: Metric; rf_accuracy?: Metric; xgb_accuracy?: Metric;
  cv_accuracy?: Metric; cv_std?: Metric; n_samples?: Metric; n_features?: Metric;
  ensemble_method?: string | null; training_date?: string | null;
  feature_columns?: string[] | null; positive_ratio?: Metric;
  dataset?: string | null; cities?: Metric; atms?: Metric;
  top_k_accuracy?: { top_1_hit_rate?: Metric; top_3_hit_rate?: Metric; top_5_hit_rate?: Metric } | null;
  feature_importances?: Record<string, Metric> | { feature: string; importance: Metric }[] | null;
  roc_curve?: ModelMetrics['roc_curve'];
}
export function featureImportances(card: ModelCard) {
  const source = card.feature_importances;
  const rows = Array.isArray(source) ? source : Object.entries(source ?? {}).map(([feature, importance]) => ({ feature, importance }));
  return rows.filter((row): row is { feature: string; importance: number } => typeof row.feature === 'string' && isMeasured(row.importance) && row.importance >= 0)
    .sort((a, b) => b.importance - a.importance);
}
