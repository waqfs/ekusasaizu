/**
 * Config-driven exercise analyzer.
 *
 * Reads a JSON exercise configuration (fetched from the backend) and uses it to:
 * 1. Compute relevant joint angles from landmarks
 * 2. Drive a phase state machine with hysteresis
 * 3. Evaluate form checks against thresholds
 * 4. Score each rep based on configured weights
 */

import type { NormalizedLandmark, FormEvent } from './types';

// --- Types for the JSON config ---

export interface AngleConfig {
  description: string;
  left: [number, number, number];
  right: [number, number, number];
  average: boolean;
}

export interface PhaseCondition {
  angle: string;
  above?: number;
  below?: number;
  direction?: 'increasing' | 'decreasing';
}

export interface PhaseConfig {
  description: string;
  condition: PhaseCondition;
  exit: PhaseCondition;
}

export interface FormCheckConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  angle?: string;
  phase?: string;
  // angle_threshold
  good_below?: number;
  good_above?: number;
  warn_above?: number;
  warn_below?: number;
  // angle_range
  good_min?: number;
  good_max?: number;
  // distance_ratio
  numerator_landmarks?: [number, number];
  denominator_landmarks?: [number, number];
  axis?: 'x' | 'y' | 'z';
  // angle_symmetry
  max_diff?: number;
  warn_diff?: number;
  // velocity
  max_velocity?: number;
  // common
  severity: string;
  event_type: string;
  message: string;
}

export interface ExerciseConfig {
  id: string;
  name: string;
  type: 'rep' | 'hold';
  description: string;
  camera_angle: string;
  angles: Record<string, AngleConfig>;
  phases: Record<string, PhaseConfig>;
  phase_order: string[];
  rep_cycle: string[];
  form_checks: FormCheckConfig[];
  scoring: {
    components: Array<{
      name: string;
      weight: number;
      angle?: string;
      ideal_at_bottom?: number;
      ideal_at_top?: number;
      ideal?: number;
      ideal_angle?: number;
      penalty_per_degree?: number;
      form_check?: string;
      penalty_multiplier?: number;
    }>;
  };
  smoothing: {
    ema_alpha: number;
    buffer_size: number;
    min_dwell_ms: number;
    velocity_threshold: number;
  };
  per_side?: boolean;
}

// --- Angle computation ---

function angleBetween(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  // Use 2D (x, y) only — MediaPipe z-depth from a single camera is unreliable
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// --- EMA Angle Buffer ---

class AngleBuffer {
  private buffer: number[] = [];
  private _smoothed = 0;
  private _velocity = 0;
  private readonly alpha: number;
  private readonly maxSize: number;

  constructor(alpha = 0.3, maxSize = 15) {
    this.alpha = alpha;
    this.maxSize = maxSize;
  }

  update(raw: number): void {
    this.buffer.push(raw);
    if (this.buffer.length > this.maxSize) this.buffer.shift();
    const prev = this._smoothed;
    this._smoothed = this.alpha * raw + (1 - this.alpha) * prev;
    this._velocity = (this._smoothed - prev) * 30; // degrees/sec at 30fps
  }

  get value(): number {
    return this._smoothed;
  }
  get velocity(): number {
    return this._velocity;
  }
  get isIncreasing(): boolean {
    return this._velocity > 5;
  }
  get isDecreasing(): boolean {
    return this._velocity < -5;
  }
  get raw(): number {
    return this.buffer[this.buffer.length - 1] ?? 0;
  }

  /** Get left/right raw values for symmetry checks */
  leftRight: [number, number] = [0, 0];
}

// --- Per-side tracking state ---

interface SideState {
  angleBuffers: Map<string, AngleBuffer>;
  currentPhase: string;
  phaseEnteredAt: number;
  repPhaseIndex: number;
  /** Track min/max angle values during the current rep cycle for accurate scoring */
  repAngleExtremes: Map<string, { min: number; max: number }>;
}

// --- Config-Driven Analyzer ---

export class ConfigDrivenAnalyzer {
  private config: ExerciseConfig;
  private sides: SideState[];
  private _repCount = 0;
  private _lastRepScore = 0;

  constructor(config: ExerciseConfig) {
    this.config = config;
    const startPhase = config.phase_order[0];

    if (config.per_side) {
      // Two independent side trackers
      this.sides = [this.createSide(startPhase), this.createSide(startPhase)];
    } else {
      this.sides = [this.createSide(startPhase)];
    }
  }

  private createSide(startPhase: string): SideState {
    const angleBuffers = new Map<string, AngleBuffer>();
    for (const name of Object.keys(this.config.angles)) {
      angleBuffers.set(name, new AngleBuffer(this.config.smoothing.ema_alpha, this.config.smoothing.buffer_size));
    }
    return { angleBuffers, currentPhase: startPhase, phaseEnteredAt: 0, repPhaseIndex: 0, repAngleExtremes: new Map() };
  }

  get repCount(): number {
    return this._repCount;
  }
  get lastRepScore(): number {
    return this._lastRepScore;
  }
  get phase(): string {
    return this.sides[0].currentPhase;
  }
  get phaseIndex(): number {
    return this.sides[0].repPhaseIndex;
  }

  /** Get current smoothed angle values for debug display */
  getAngleValues(): Record<string, number> {
    const result: Record<string, number> = {};
    if (this.config.per_side) {
      for (const [name, buffer] of this.sides[0].angleBuffers) {
        result[`L_${name}`] = Math.round(buffer.value);
      }
      for (const [name, buffer] of this.sides[1].angleBuffers) {
        result[`R_${name}`] = Math.round(buffer.value);
      }
    } else {
      for (const [name, buffer] of this.sides[0].angleBuffers) {
        result[name] = Math.round(buffer.value);
      }
    }
    return result;
  }

  /**
   * Process a frame of landmarks and return form events.
   */
  process(landmarks: NormalizedLandmark[]): FormEvent[] {
    if (landmarks.length < 33) return [];

    const now = performance.now();
    const events: FormEvent[] = [];

    if (this.config.per_side) {
      // Compute angles for each side independently
      this.computeAnglesForSide(landmarks, this.sides[0], 'left');
      this.computeAnglesForSide(landmarks, this.sides[1], 'right');

      // Update phase machines for each side
      for (const side of this.sides) {
        this.updateAngleExtremes(side);
        const phaseEvent = this.updatePhase(now, side);
        if (phaseEvent) events.push(phaseEvent);
      }
    } else {
      // Standard averaged angles
      this.computeAnglesAveraged(landmarks, this.sides[0]);
      this.updateAngleExtremes(this.sides[0]);
      const phaseEvent = this.updatePhase(now, this.sides[0]);
      if (phaseEvent) events.push(phaseEvent);
    }

    // Run form checks using the first (or averaged) side
    const formEvents = this.runFormChecks();
    events.push(...formEvents);

    if (formEvents.length === 0 && this.sides[0].currentPhase !== 'idle') {
      events.push({ type: 'good_form' });
    }

    return events;
  }

  private computeAnglesAveraged(landmarks: NormalizedLandmark[], side: SideState): void {
    for (const [name, angleCfg] of Object.entries(this.config.angles)) {
      const buffer = side.angleBuffers.get(name)!;
      const leftAngle = angleBetween(landmarks[angleCfg.left[0]], landmarks[angleCfg.left[1]], landmarks[angleCfg.left[2]]);
      const rightAngle = angleBetween(landmarks[angleCfg.right[0]], landmarks[angleCfg.right[1]], landmarks[angleCfg.right[2]]);
      const avg = angleCfg.average ? (leftAngle + rightAngle) / 2 : leftAngle;
      buffer.update(avg);
      buffer.leftRight = [leftAngle, rightAngle];
    }
  }

  private computeAnglesForSide(landmarks: NormalizedLandmark[], side: SideState, which: 'left' | 'right'): void {
    for (const [name, angleCfg] of Object.entries(this.config.angles)) {
      const buffer = side.angleBuffers.get(name)!;
      const triplet = which === 'left' ? angleCfg.left : angleCfg.right;
      const angle = angleBetween(landmarks[triplet[0]], landmarks[triplet[1]], landmarks[triplet[2]]);
      buffer.update(angle);
    }
  }

  private updatePhase(now: number, side: SideState): FormEvent | null {
    const minDwell = this.config.smoothing.min_dwell_ms;

    const currentPhaseCfg = this.config.phases[side.currentPhase];
    if (!currentPhaseCfg) return null;

    const exitCondition = currentPhaseCfg.exit;
    if (this.checkCondition(exitCondition, side) && now - side.phaseEnteredAt >= minDwell) {
      const nextPhaseIndex = (this.config.phase_order.indexOf(side.currentPhase) + 1) % this.config.phase_order.length;
      const nextPhase = this.config.phase_order[nextPhaseIndex];
      const nextPhaseCfg = this.config.phases[nextPhase];

      if (nextPhaseCfg && this.checkCondition(nextPhaseCfg.condition, side)) {
        const prevPhase = side.currentPhase;
        side.currentPhase = nextPhase;
        side.phaseEnteredAt = now;
        return this.trackRepCycle(prevPhase, nextPhase, side);
      }
    }

    return null;
  }

  private trackRepCycle(fromPhase: string, toPhase: string, side: SideState): FormEvent | null {
    const cycle = this.config.rep_cycle;
    const expectedFrom = cycle[side.repPhaseIndex];
    const expectedTo = cycle[side.repPhaseIndex + 1];

    if (fromPhase === expectedFrom && toPhase === expectedTo) {
      side.repPhaseIndex++;

      if (side.repPhaseIndex >= cycle.length - 1) {
        side.repPhaseIndex = 0;
        this._repCount++;
        this._lastRepScore = this.computeRepScore();
        side.repAngleExtremes.clear();
        return { type: 'rep_completed', score: this._lastRepScore };
      }
    } else {
      side.repPhaseIndex = 0;
    }

    return null;
  }

  private checkCondition(condition: PhaseCondition, side: SideState): boolean {
    const buffer = side.angleBuffers.get(condition.angle);
    if (!buffer) return false;

    const val = buffer.value;

    if (condition.above !== undefined && val <= condition.above) return false;
    if (condition.below !== undefined && val >= condition.below) return false;
    if (condition.direction === 'increasing' && !buffer.isIncreasing) return false;
    if (condition.direction === 'decreasing' && !buffer.isDecreasing) return false;

    return true;
  }

  /** Track min/max angle values during the current rep cycle */
  private updateAngleExtremes(side: SideState): void {
    for (const [name, buffer] of side.angleBuffers) {
      const val = buffer.value;
      const ext = side.repAngleExtremes.get(name);
      if (ext) {
        ext.min = Math.min(ext.min, val);
        ext.max = Math.max(ext.max, val);
      } else {
        side.repAngleExtremes.set(name, { min: val, max: val });
      }
    }
  }

  private runFormChecks(): FormEvent[] {
    const events: FormEvent[] = [];

    for (const check of this.config.form_checks) {
      // Skip phase-specific checks if we're not in the right phase
      if (check.phase && check.phase !== this.currentPhase) continue;

      const issue = this.evaluateFormCheck(check);
      if (issue) events.push(issue);
    }

    return events;
  }

  private evaluateFormCheck(check: FormCheckConfig): FormEvent | null {
    switch (check.type) {
      case 'angle_threshold':
        return this.checkAngleThreshold(check);
      case 'angle_range':
        return this.checkAngleRange(check);
      case 'distance_ratio':
        return this.checkDistanceRatio(check);
      case 'angle_symmetry':
        return this.checkAngleSymmetry(check);
      case 'velocity':
        return this.checkVelocity(check);
      default:
        return null;
    }
  }

  private checkAngleThreshold(check: FormCheckConfig): FormEvent | null {
    if (!check.angle) return null;
    const buffer = this.sides[0].angleBuffers.get(check.angle);
    if (!buffer) return null;

    const val = buffer.value;
    if (check.warn_above !== undefined && val > check.warn_above) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    if (check.warn_below !== undefined && val < check.warn_below) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    return null;
  }

  private checkAngleRange(check: FormCheckConfig): FormEvent | null {
    if (!check.angle) return null;
    const buffer = this.sides[0].angleBuffers.get(check.angle);
    if (!buffer) return null;

    const val = buffer.value;
    if (check.warn_below !== undefined && val < check.warn_below) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    if (check.warn_above !== undefined && val > check.warn_above) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    return null;
  }

  private checkDistanceRatio(_check: FormCheckConfig): FormEvent | null {
    // Distance ratio checks need raw landmarks — we'd need to pass them through
    // For now, skip (would need refactoring to pass landmarks into form checks)
    return null;
  }

  private checkAngleSymmetry(check: FormCheckConfig): FormEvent | null {
    if (!check.angle) return null;
    const buffer = this.sides[0].angleBuffers.get(check.angle);
    if (!buffer) return null;

    const [left, right] = buffer.leftRight;
    const diff = Math.abs(left - right);
    if (check.warn_diff !== undefined && diff > check.warn_diff) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    return null;
  }

  private checkVelocity(check: FormCheckConfig): FormEvent | null {
    if (!check.angle) return null;
    const buffer = this.sides[0].angleBuffers.get(check.angle);
    if (!buffer) return null;

    if (check.max_velocity !== undefined && Math.abs(buffer.velocity) > check.max_velocity) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    return null;
  }

  private computeRepScore(): number {
    let totalScore = 0;
    let totalWeight = 0;
    const extremes = this.sides[0].repAngleExtremes;

    for (const component of this.config.scoring.components) {
      let score = 100;

      if (component.angle) {
        const ext = extremes.get(component.angle);
        if (ext) {
          // Use the angle extreme that corresponds to the ideal phase:
          // ideal_at_bottom → use minimum angle observed during rep
          // ideal_at_top → use maximum angle observed during rep
          // ideal → use the extreme closest to ideal
          if (component.ideal_at_bottom != null) {
            const penalty = Math.abs(ext.min - component.ideal_at_bottom) * (component.penalty_per_degree ?? 2);
            score = Math.max(0, 100 - penalty);
          } else if (component.ideal_at_top != null) {
            const penalty = Math.abs(ext.max - component.ideal_at_top) * (component.penalty_per_degree ?? 2);
            score = Math.max(0, 100 - penalty);
          } else if (component.ideal != null) {
            // Use whichever extreme is closer to the ideal
            const distMin = Math.abs(ext.min - component.ideal);
            const distMax = Math.abs(ext.max - component.ideal);
            const bestVal = distMin < distMax ? ext.min : ext.max;
            const penalty = Math.abs(bestVal - component.ideal) * (component.penalty_per_degree ?? 2);
            score = Math.max(0, 100 - penalty);
          }
        }
      }

      if (component.form_check) {
        // Check if this form issue was triggered
        const check = this.config.form_checks.find(c => c.id === component.form_check);
        if (check) {
          const issue = this.evaluateFormCheck(check);
          if (issue) {
            score = Math.max(0, 100 - (component.penalty_multiplier ?? 20));
          }
        }
      }

      totalScore += score * component.weight;
      totalWeight += component.weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  reset(): void {
    this._repCount = 0;
    this._lastRepScore = 0;
    const startPhase = this.config.phase_order[0];
    for (const side of this.sides) {
      side.repPhaseIndex = 0;
      side.currentPhase = startPhase;
      side.phaseEnteredAt = 0;
      side.repAngleExtremes.clear();
    }
  }
}
