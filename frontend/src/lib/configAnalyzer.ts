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

// --- Config-Driven Analyzer ---

export class ConfigDrivenAnalyzer {
  private config: ExerciseConfig;
  private angleBuffers: Map<string, AngleBuffer> = new Map();
  private currentPhase: string;
  private phaseEnteredAt = 0;
  private repPhaseIndex = 0; // tracks progress through rep_cycle
  private _repCount = 0;
  private _lastRepScore = 0;
  private minAnglesAtPhase: Map<string, Map<string, number>> = new Map(); // per-phase angle minimums

  constructor(config: ExerciseConfig) {
    this.config = config;
    this.currentPhase = config.phase_order[0];

    // Initialize angle buffers
    for (const [name, angleCfg] of Object.entries(config.angles)) {
      const buf = new AngleBuffer(config.smoothing.ema_alpha, config.smoothing.buffer_size);
      this.angleBuffers.set(name, buf);
    }
  }

  get repCount(): number {
    return this._repCount;
  }
  get lastRepScore(): number {
    return this._lastRepScore;
  }
  get phase(): string {
    return this.currentPhase;
  }
  get phaseIndex(): number {
    return this.repPhaseIndex;
  }

  /** Get current smoothed angle values for debug display */
  getAngleValues(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, buffer] of this.angleBuffers) {
      result[name] = Math.round(buffer.value);
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

    // 1. Compute and smooth all configured angles
    this.computeAngles(landmarks);

    // 2. Update phase state machine
    const phaseEvent = this.updatePhase(now);
    if (phaseEvent) events.push(phaseEvent);

    // 3. Run form checks
    const formEvents = this.runFormChecks();
    events.push(...formEvents);

    // If no issues detected, emit good_form
    if (formEvents.length === 0 && this.currentPhase !== 'idle') {
      events.push({ type: 'good_form' });
    }

    return events;
  }

  private computeAngles(landmarks: NormalizedLandmark[]): void {
    for (const [name, angleCfg] of Object.entries(this.config.angles)) {
      const buffer = this.angleBuffers.get(name)!;
      const leftAngle = angleBetween(landmarks[angleCfg.left[0]], landmarks[angleCfg.left[1]], landmarks[angleCfg.left[2]]);
      const rightAngle = angleBetween(landmarks[angleCfg.right[0]], landmarks[angleCfg.right[1]], landmarks[angleCfg.right[2]]);
      const avg = angleCfg.average ? (leftAngle + rightAngle) / 2 : leftAngle;
      buffer.update(avg);
      buffer.leftRight = [leftAngle, rightAngle];
    }
  }

  private updatePhase(now: number): FormEvent | null {
    const minDwell = this.config.smoothing.min_dwell_ms;

    // Check if we should exit current phase
    const currentPhaseCfg = this.config.phases[this.currentPhase];
    if (!currentPhaseCfg) return null;

    const exitCondition = currentPhaseCfg.exit;
    if (this.checkCondition(exitCondition) && now - this.phaseEnteredAt >= minDwell) {
      // Find the next phase in the cycle
      const nextPhaseIndex = (this.config.phase_order.indexOf(this.currentPhase) + 1) % this.config.phase_order.length;
      const nextPhase = this.config.phase_order[nextPhaseIndex];
      const nextPhaseCfg = this.config.phases[nextPhase];

      if (nextPhaseCfg && this.checkCondition(nextPhaseCfg.condition)) {
        const prevPhase = this.currentPhase;
        this.currentPhase = nextPhase;
        this.phaseEnteredAt = now;

        // Track rep cycle progress
        return this.trackRepCycle(prevPhase, nextPhase);
      }
    }

    return null;
  }

  private trackRepCycle(fromPhase: string, toPhase: string): FormEvent | null {
    const cycle = this.config.rep_cycle;

    // Check if this transition matches the expected next step in the cycle
    const expectedFrom = cycle[this.repPhaseIndex];
    const expectedTo = cycle[this.repPhaseIndex + 1];

    if (fromPhase === expectedFrom && toPhase === expectedTo) {
      this.repPhaseIndex++;

      // Check if we've completed a full rep cycle
      if (this.repPhaseIndex >= cycle.length - 1) {
        this.repPhaseIndex = 0;
        this._repCount++;
        this._lastRepScore = this.computeRepScore();
        return { type: 'rep_completed', score: this._lastRepScore };
      }
    } else {
      // Reset cycle tracking if an unexpected transition occurs
      this.repPhaseIndex = 0;
      if (toPhase === cycle[0]) {
        // We've returned to the start position
      }
    }

    return null;
  }

  private checkCondition(condition: PhaseCondition): boolean {
    const buffer = this.angleBuffers.get(condition.angle);
    if (!buffer) return false;

    const val = buffer.value;

    if (condition.above !== undefined && val <= condition.above) return false;
    if (condition.below !== undefined && val >= condition.below) return false;
    if (condition.direction === 'increasing' && !buffer.isIncreasing) return false;
    if (condition.direction === 'decreasing' && !buffer.isDecreasing) return false;

    return true;
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
    const buffer = this.angleBuffers.get(check.angle);
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
    const buffer = this.angleBuffers.get(check.angle);
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
    const buffer = this.angleBuffers.get(check.angle);
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
    const buffer = this.angleBuffers.get(check.angle);
    if (!buffer) return null;

    if (check.max_velocity !== undefined && Math.abs(buffer.velocity) > check.max_velocity) {
      return { type: check.event_type as FormEvent['type'] } as FormEvent;
    }
    return null;
  }

  private computeRepScore(): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const component of this.config.scoring.components) {
      let score = 100;

      if (component.angle) {
        const buffer = this.angleBuffers.get(component.angle);
        if (buffer) {
          const val = buffer.value;
          const ideal = component.ideal_at_bottom ?? component.ideal_at_top ?? component.ideal ?? val;
          const penalty = Math.abs(val - ideal) * (component.penalty_per_degree ?? 2);
          score = Math.max(0, 100 - penalty);
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
    this.repPhaseIndex = 0;
    this.currentPhase = this.config.phase_order[0];
    this.phaseEnteredAt = 0;
    for (const buffer of this.angleBuffers.values()) {
      // Reinitialize buffer
    }
  }
}
