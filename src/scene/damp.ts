import type { Vector3 } from 'three';

/**
 * Critically damped follow (the "SmoothDamp" integrator). Frame-rate
 * independent, no overshoot. smoothTime ≈ time to reach the target.
 */
export class Damped {
  value: number;
  velocity = 0;
  constructor(v = 0) {
    this.value = v;
  }
  step(target: number, smoothTime: number, dt: number): number {
    const omega = 2 / Math.max(1e-4, smoothTime);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * exp;
    this.value = target + (change + temp) * exp;
    return this.value;
  }
  snap(v: number) {
    this.value = v;
    this.velocity = 0;
  }
}

export class DampedVec3 {
  x = new Damped();
  y = new Damped();
  z = new Damped();
  step(target: Vector3, smoothTime: number, dt: number, out: Vector3): Vector3 {
    return out.set(
      this.x.step(target.x, smoothTime, dt),
      this.y.step(target.y, smoothTime, dt),
      this.z.step(target.z, smoothTime, dt),
    );
  }
  snap(v: Vector3) {
    this.x.snap(v.x);
    this.y.snap(v.y);
    this.z.snap(v.z);
  }
}
