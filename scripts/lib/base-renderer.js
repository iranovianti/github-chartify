/**
 * BaseCellRenderer - Abstract base class for cell renderers
 */

const { AnimationTimeline, CycleFactory } = require('./animation-timeline');

// Constants
const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;
const DAYS_IN_WEEK = 7;

// GitHub contribution colors (light theme)
const LEVEL_COLORS = {
  'NONE': '#ebedf0',
  'FIRST_QUARTILE': '#9be9a8',
  'SECOND_QUARTILE': '#40c463',
  'THIRD_QUARTILE': '#30a14e',
  'FOURTH_QUARTILE': '#216e39'
};

// GitHub contribution colors (dark theme)
const LEVEL_COLORS_DARK = {
  'NONE': '#161b22',
  'FIRST_QUARTILE': '#0e4429',
  'SECOND_QUARTILE': '#006d32',
  'THIRD_QUARTILE': '#26a641',
  'FOURTH_QUARTILE': '#39d353'
};

// Helper to get colors by theme
function getLevelColors(theme = 'light') {
  return theme === 'dark' ? LEVEL_COLORS_DARK : LEVEL_COLORS;
}

// Contribution level to multiplier
const LEVEL_TO_MULTIPLIER = {
  'NONE': 0,
  'FIRST_QUARTILE': 0.25,
  'SECOND_QUARTILE': 0.5,
  'THIRD_QUARTILE': 0.75,
  'FOURTH_QUARTILE': 1.0
};

// Level to circle count (for circle renderer)
const LEVEL_TO_COUNT = {
  'NONE': 0,
  'FIRST_QUARTILE': 1,
  'SECOND_QUARTILE': 2,
  'THIRD_QUARTILE': 3,
  'FOURTH_QUARTILE': 4
};

// Speed presets (timing values in seconds)
const SPEED_PRESETS = {
  fast: { gridHold: 0.25, transformDur: 0.25, vStackDur: 0.5, stackedHold: 0.5, hSpeedMult: 3.0 },
  medium: { gridHold: 0.5, transformDur: 0.5, vStackDur: 1.0, stackedHold: 1.0, hSpeedMult: 3.0 },
  slow: { gridHold: 1.0, transformDur: 1.0, vStackDur: 2.0, stackedHold: 2.0, hSpeedMult: 3.0 }
};

class BaseCellRenderer {
  constructor(config, theme = 'light') {
    this.config = config;
    this.theme = theme;
    
    // Get timing from speed preset or use fast as default
    const animation = config.animation || {};
    const speed = animation.speed || 'fast';
    this.timing = SPEED_PRESETS[speed] || SPEED_PRESETS.fast;
    
    // Animation options
    this.mode = animation.mode || 'both';  // 'both', 'vertical', 'horizontal'
    this.loop = animation.loop !== false;  // default true
    this.repeatCount = this.loop ? 'indefinite' : '1';
    this.fillFreeze = this.loop ? '' : ' fill="freeze"';  // Freeze at final state when not looping
    
    // Which animations to include
    this.includeVertical = this.mode === 'both' || this.mode === 'vertical';
    this.includeHorizontal = this.mode === 'both' || this.mode === 'horizontal';
    
    // For no-loop mode, use forward-only cycles (no reverse animation)
    const forwardOnly = !this.loop;
    
    this.stagger = config.stagger || { enabled: false };
    this.stack = config.stack || { growOnJoin: false };
    
    // Bar color: support theme-specific colors or use theme-appropriate defaults
    const defaultLightBarColor = '#216e39';
    const defaultDarkBarColor = '#39d353';
    const configBarColor = config.colors?.barColor;
    
    // If config specifies a barColor that's the default light color, use theme defaults
    // Otherwise respect the config value
    if (!configBarColor || configBarColor === defaultLightBarColor) {
      this.barColor = theme === 'dark' ? defaultDarkBarColor : defaultLightBarColor;
    } else {
      this.barColor = configBarColor;
    }
    
    // Calculate cycle timings
    this.staggerExtra = this.stagger.enabled ? this.stagger.maxDelay : 0;
    
    // Only include cycles for the modes we need
    if (this.includeVertical) {
      this.vCycle = CycleFactory.createCycle({
        gridHold: this.timing.gridHold,
        transformDur: this.timing.transformDur,
        stackDur: this.timing.vStackDur,
        stackedHold: this.timing.stackedHold,
        staggerExtra: this.staggerExtra
      }, 0, forwardOnly);
    } else {
      // Dummy cycle with zero duration
      this.vCycle = { duration: 0, forwardOnly, times: { start: 0, transformStart: 0, transformEnd: 0, stackEnd: 0, holdEnd: 0, unstackEnd: 0, untransformEnd: 0, end: 0 } };
    }
    
    if (this.includeHorizontal) {
      this.hCycle = CycleFactory.createCycle({
        gridHold: this.timing.gridHold,
        transformDur: this.timing.transformDur,
        stackDur: this.timing.vStackDur * this.timing.hSpeedMult,
        stackedHold: this.timing.stackedHold,
        staggerExtra: this.staggerExtra
      }, this.vCycle.duration, forwardOnly);
    } else {
      // Dummy cycle starting after vCycle
      const offset = this.vCycle.duration;
      this.hCycle = { duration: 0, forwardOnly, times: { start: offset, transformStart: offset, transformEnd: offset, stackEnd: offset, holdEnd: offset, unstackEnd: offset, untransformEnd: offset, end: offset } };
    }
    
    this.totalDuration = this.vCycle.duration + this.hCycle.duration;
    
    // Random delays cache for stagger
    this.randomDelays = {};
  }

  /**
   * Build mode-aware keyTimes string.
   * Takes arrays for V and H keyframes, only includes enabled modes.
   */
  buildKeyTimes(vTimes, hTimes) {
    const times = [];
    
    if (this.includeVertical) {
      times.push(...vTimes.map(t => this.f(t)));
    } else {
      // H-only: add single keyframe at 0 for initial state
      times.push(this.f(0));
    }
    
    if (this.includeHorizontal) {
      times.push(...hTimes.map(t => this.f(t)));
    } else {
      // V-only: add single keyframe at end for final state
      if (times.length > 0 && times[times.length - 1] !== this.f(this.totalDuration)) {
        times.push(this.f(this.totalDuration));
      }
    }
    
    return times.join('; ');
  }

  /**
   * Build mode-aware values string.
   * Takes arrays for V and H values, only includes enabled modes.
   * Ensures value counts match keyTimes.
   */
  buildValues(vVals, hVals, defaultVal) {
    const vals = [];
    
    if (this.includeVertical) {
      vals.push(...vVals);
    } else {
      // H-only: single value for initial state
      vals.push(defaultVal);
    }
    
    if (this.includeHorizontal) {
      vals.push(...hVals);
    } else {
      // V-only: single value for final state
      if (vals.length > 0 && vals[vals.length - 1] !== defaultVal) {
        vals.push(defaultVal);
      }
    }
    
    return vals.join('; ');
  }

  /**
   * Get timing info for external use (labels, etc.)
   */
  getTimingInfo() {
    return {
      vCycle: this.vCycle,
      hCycle: this.hCycle,
      total: this.totalDuration
    };
  }

  /**
   * Calculate stagger delay for a cell
   */
  calculateStaggerDelay(weekIndex, dayIndex, numWeeks) {
    if (!this.stagger.enabled) return 0;
    
    let normalizedPosition;
    
    switch (this.stagger.order) {
      case 'left-to-right':
        normalizedPosition = weekIndex / (numWeeks - 1);
        break;
      case 'right-to-left':
        normalizedPosition = 1 - (weekIndex / (numWeeks - 1));
        break;
      case 'top-to-bottom':
        normalizedPosition = dayIndex / (DAYS_IN_WEEK - 1);
        break;
      case 'bottom-to-top':
        normalizedPosition = 1 - (dayIndex / (DAYS_IN_WEEK - 1));
        break;
      case 'diagonal':
        normalizedPosition = (weekIndex + dayIndex) / (numWeeks - 1 + DAYS_IN_WEEK - 1);
        break;
      case 'random':
        const key = `${weekIndex}-${dayIndex}`;
        if (!(key in this.randomDelays)) {
          this.randomDelays[key] = Math.random();
        }
        normalizedPosition = this.randomDelays[key];
        break;
      case 'none':
      default:
        normalizedPosition = 0;
    }
    
    return normalizedPosition * this.stagger.maxDelay;
  }

  /**
   * Convert time to fraction string
   */
  f(t) {
    return (t / this.totalDuration).toFixed(4);
  }

  /**
   * Calculate vertical stack info for all weeks
   */
  calculateVerticalStacks(weeks) {
    return weeks.map(week => {
      const activeDays = week.days.filter(d => d.heightMultiplier > 0);
      const barHeights = activeDays.map(d => this.getCellStackHeight(d));
      const totalHeight = barHeights.reduce((sum, h) => sum + h, 0);
      return { barHeights, totalHeight, count: activeDays.length };
    });
  }

  /**
   * Calculate horizontal stack info for all days
   */
  calculateHorizontalStacks(weeks) {
    const dayStacks = [];
    for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex++) {
      const barWidths = [];
      let count = 0;
      weeks.forEach(week => {
        const day = week.days[dayIndex];
        if (day && day.heightMultiplier > 0) {
          barWidths.push(this.getCellStackWidth(day));
          count++;
        }
      });
      const totalWidth = barWidths.reduce((sum, w) => sum + w, 0);
      dayStacks.push({ barWidths, totalWidth, count });
    }
    return dayStacks;
  }

  // ========== Methods to be overridden by subclasses ==========

  getCellStackHeight(day) {
    return Math.round(day.heightMultiplier * CELL_SIZE);
  }

  getCellStackWidth(day) {
    return Math.round(day.heightMultiplier * CELL_SIZE);
  }

  /**
   * Render an empty (level=NONE) cell
   */
  renderEmptyCell(x, y, color) {
    const V = this.vCycle.times;
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    
    const keyTimesArr = [];
    const opacityArr = [];
    
    if (this.includeVertical) {
      if (forwardOnly) {
        keyTimesArr.push(V.start, V.transformStart, V.transformEnd, V.holdEnd);
        opacityArr.push(1, 1, 0, 0);
      } else {
        keyTimesArr.push(V.start, V.transformStart, V.transformEnd, V.unstackEnd, V.untransformEnd, V.end);
        opacityArr.push(1, 1, 0, 0, 1, 1);
      }
    } else {
      keyTimesArr.push(0);
      opacityArr.push(1);
    }
    
    if (this.includeHorizontal) {
      if (forwardOnly) {
        if (this.includeVertical) {
          keyTimesArr.push(H.holdEnd);
          opacityArr.push(0);
        } else {
          keyTimesArr.push(H.transformStart, H.transformEnd, H.holdEnd);
          opacityArr.push(1, 0, 0);
        }
      } else {
        keyTimesArr.push(H.transformStart, H.transformEnd, H.unstackEnd, H.untransformEnd, H.end);
        opacityArr.push(1, 0, 0, 1, 1);
      }
    } else if (!forwardOnly) {
      keyTimesArr.push(this.totalDuration);
      opacityArr.push(1);
    }
    
    const keyTimes = keyTimesArr.map(t => this.f(t)).join('; ');
    const opacity = opacityArr.join('; ');
    
    return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${color}">
    <animate attributeName="opacity" values="${opacity}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
  }

  /**
   * Render an active (level>NONE) cell with animations
   * Override in subclass
   */
  renderActiveCell(cellData) {
    throw new Error('renderActiveCell must be implemented by subclass');
  }

  /**
   * Render the solid bar overlay for vertical stacking
   * Override in subclass
   */
  renderVerticalBar(x, y, width, height, landingData = null) {
    throw new Error('renderVerticalBar must be implemented by subclass');
  }

  /**
   * Render the solid bar overlay for horizontal stacking
   * Override in subclass
   */
  renderHorizontalBar(x, y, width, height, landingData = null) {
    throw new Error('renderHorizontalBar must be implemented by subclass');
  }

  /**
   * Calculate per-cell vertical landing times for a column
   * Used for growOnJoin mode
   * @param {Array} columnCells - Array of {startY, height, targetY} for each active cell
   * @returns {Array} Array of {landingTime, height, cumulativeHeight, startY} sorted by landing time
   */
  calculateVerticalLandingTimes(columnCells) {
    if (columnCells.length === 0) return [];
    
    const V = this.vCycle.times;
    const stackDur = V.stackEnd - V.transformEnd;
    
    // Calculate travel distance for each cell
    // Note: In SVG coordinate system, Y increases downward
    // Cell starts at startY, needs to reach targetY
    const cellsWithDistance = columnCells.map(cell => {
      // After transform, cell top moves down slightly due to shrink
      // Simplified: assume cell moves from its grid position to target
      const shrunkTop = cell.startY + (CELL_SIZE - cell.height); // top of shrunk cell
      const distance = cell.targetY - shrunkTop; // positive = moving down
      return { ...cell, shrunkTop, distance };
    });
    
    // Find the maximum distance (this cell takes the full stackDur)
    const maxDistance = Math.max(...cellsWithDistance.map(c => Math.abs(c.distance)));
    
    if (maxDistance === 0) {
      // All cells are already at their positions
      return columnCells.map((cell, i) => ({
        landingTime: V.transformEnd,
        landingFraction: 0,
        height: cell.height,
        cumulativeHeight: columnCells.slice(0, i + 1).reduce((sum, c) => sum + c.height, 0),
        startY: cell.startY
      }));
    }
    
    // Calculate landing time for each cell (proportional to distance)
    const landingData = cellsWithDistance.map(cell => {
      const landingFraction = Math.abs(cell.distance) / maxDistance; // 0 = lands first, 1 = lands last
      const landingTime = V.transformEnd + landingFraction * stackDur;
      return {
        landingTime,
        landingFraction,
        height: cell.height,
        startY: cell.startY
      };
    });
    
    // Sort by landing time (earliest first)
    landingData.sort((a, b) => a.landingTime - b.landingTime);
    
    // Calculate cumulative height at each landing
    let cumHeight = 0;
    landingData.forEach(d => {
      cumHeight += d.height;
      d.cumulativeHeight = cumHeight;
    });
    
    return landingData;
  }

  /**
   * Calculate per-cell horizontal landing times for a row
   * Used for growOnJoin mode
   * @param {Array} rowCells - Array of {startX, width, targetX} for each active cell
   * @returns {Array} Array of {landingTime, width, cumulativeWidth, startX} sorted by landing time
   */
  calculateHorizontalLandingTimes(rowCells) {
    if (rowCells.length === 0) return [];
    
    const H = this.hCycle.times;
    const stackDur = H.stackEnd - H.transformEnd;
    
    // Calculate travel distance for each cell
    const cellsWithDistance = rowCells.map(cell => {
      // Travel distance (leftward movement)
      const distance = cell.startX - cell.targetX; // positive = moving left
      return { ...cell, distance };
    });
    
    // Find the maximum distance
    const maxDistance = Math.max(...cellsWithDistance.map(c => Math.abs(c.distance)));
    
    if (maxDistance === 0) {
      return rowCells.map((cell, i) => ({
        landingTime: H.transformEnd,
        landingFraction: 0,
        width: cell.width,
        cumulativeWidth: rowCells.slice(0, i + 1).reduce((sum, c) => sum + c.width, 0),
        startX: cell.startX
      }));
    }
    
    // Calculate landing time for each cell
    const landingData = cellsWithDistance.map(cell => {
      const landingFraction = Math.abs(cell.distance) / maxDistance;
      const landingTime = H.transformEnd + landingFraction * stackDur;
      return {
        landingTime,
        landingFraction,
        width: cell.width,
        startX: cell.startX,
        weekIndex: cell.weekIndex  // Preserve for stagger calculation
      };
    });
    
    // Sort by landing time
    landingData.sort((a, b) => a.landingTime - b.landingTime);
    
    // Calculate cumulative width
    let cumWidth = 0;
    landingData.forEach(d => {
      cumWidth += d.width;
      d.cumulativeWidth = cumWidth;
    });
    
    return landingData;
  }

  /**
   * Get renderer name for logging
   */
  getName() {
    return 'BaseRenderer';
  }
}

module.exports = {
  BaseCellRenderer,
  CELL_SIZE,
  CELL_GAP,
  CELL_TOTAL,
  DAYS_IN_WEEK,
  LEVEL_COLORS,
  LEVEL_COLORS_DARK,
  getLevelColors,
  LEVEL_TO_MULTIPLIER,
  LEVEL_TO_COUNT
};
