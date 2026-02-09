/**
 * AnimationTimeline - A declarative timeline builder for SVG animations
 * 
 * Handles keyframe timing calculations and value interpolation across
 * multiple animation phases (grid → transform → stack → hold → reverse)
 */

class AnimationTimeline {
  constructor(totalDuration) {
    this.total = totalDuration;
    this.phases = [];
    this.currentTime = 0;
  }

  /**
   * Add a phase to the timeline
   * @param {string} name - Phase identifier
   * @param {number} duration - Duration in seconds
   * @param {Object} props - Property values during this phase { propName: value }
   */
  addPhase(name, duration, props = {}) {
    this.phases.push({
      name,
      startTime: this.currentTime,
      duration,
      endTime: this.currentTime + duration,
      props
    });
    this.currentTime += duration;
    return this;
  }

  /**
   * Get the phase by name
   */
  getPhase(name) {
    return this.phases.find(p => p.name === name);
  }

  /**
   * Get start time of a phase as fraction of total
   */
  getPhaseStart(name) {
    const phase = this.getPhase(name);
    return phase ? phase.startTime / this.total : 0;
  }

  /**
   * Get end time of a phase as fraction of total
   */
  getPhaseEnd(name) {
    const phase = this.getPhase(name);
    return phase ? phase.endTime / this.total : 0;
  }

  /**
   * Compile keyframes for a specific property
   * Returns { keyTimes: string, values: string } for SVG animate
   */
  compile(propertyName) {
    const keyTimes = [];
    const values = [];

    for (const phase of this.phases) {
      if (propertyName in phase.props) {
        keyTimes.push((phase.startTime / this.total).toFixed(4));
        values.push(phase.props[propertyName]);
      }
    }

    // Add final keyframe at end if not already there
    const lastPhase = this.phases[this.phases.length - 1];
    if (lastPhase && propertyName in lastPhase.props) {
      const endFraction = (lastPhase.endTime / this.total).toFixed(4);
      if (keyTimes[keyTimes.length - 1] !== endFraction) {
        keyTimes.push(endFraction);
        values.push(lastPhase.props[propertyName]);
      }
    }

    return {
      keyTimes: keyTimes.join('; '),
      values: values.join('; ')
    };
  }

  /**
   * Build animation keyframes from a state sequence
   * Each entry: { time: number (seconds), props: { propName: value } }
   * More flexible than phase-based for complex animations
   */
  static fromKeyframes(totalDuration, keyframes) {
    const result = {};

    // Collect all property names
    const allProps = new Set();
    keyframes.forEach(kf => {
      Object.keys(kf.props).forEach(p => allProps.add(p));
    });

    // Build keyTimes and values for each property
    allProps.forEach(propName => {
      const keyTimes = [];
      const values = [];

      keyframes.forEach(kf => {
        if (propName in kf.props) {
          keyTimes.push((kf.time / totalDuration).toFixed(4));
          values.push(kf.props[propName]);
        }
      });

      result[propName] = {
        keyTimes: keyTimes.join('; '),
        values: values.join('; ')
      };
    });

    return result;
  }
}

/**
 * Factory to create standard animation cycles
 */
class CycleFactory {
  /**
   * Create timing config for a single animation cycle
   * @param {Object} config - Timing configuration
   * @param {number} offset - Time offset for this cycle (e.g., V_CYCLE for H cycle)
   * @param {boolean} forwardOnly - If true, stop at holdEnd (no reverse animation)
   */
  static createCycle(config, offset = 0, forwardOnly = false) {
    const {
      gridHold,
      transformDur,
      stackDur,
      stackedHold,
      staggerExtra = 0
    } = config;

    let cycleDuration;
    let times;

    if (forwardOnly) {
      // Forward-only: grid → transform → stack → hold (ends there)
      cycleDuration = 
        gridHold +           // Initial grid hold
        transformDur +       // Transform (shrink/morph)
        stackDur +           // Stack animation
        staggerExtra +       // Extra time for stagger
        stackedHold;         // Hold at stacked position (ends here)

      let t = offset;
      times = {
        start: t,
        transformStart: t += gridHold,
        transformEnd: t += transformDur,
        stackEnd: t += stackDur + staggerExtra,
        holdEnd: t += stackedHold,
        // For forward-only, these are all at holdEnd (no reverse)
        unstackEnd: t,
        untransformEnd: t,
        end: t
      };
    } else {
      // Full cycle with reverse animation
      cycleDuration = 
        gridHold +           // Initial grid hold
        transformDur +       // Transform (shrink/morph)
        stackDur +           // Stack animation
        staggerExtra +       // Extra time for stagger
        stackedHold +        // Hold at stacked position
        stackDur +           // Unstack animation
        staggerExtra +       // Extra time for stagger
        transformDur +       // Untransform
        gridHold;            // Final grid hold

      let t = offset;
      times = {
        start: t,
        transformStart: t += gridHold,
        transformEnd: t += transformDur,
        stackEnd: t += stackDur + staggerExtra,
        holdEnd: t += stackedHold,
        unstackEnd: t += stackDur + staggerExtra,
        untransformEnd: t += transformDur,
        end: t += gridHold
      };
    }

    return {
      duration: cycleDuration,
      times,
      config,
      forwardOnly
    };
  }
}

module.exports = { AnimationTimeline, CycleFactory };
