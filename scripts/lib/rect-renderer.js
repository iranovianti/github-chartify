/**
 * RectCellRenderer - Renders cells as rectangles that shrink into bar segments
 * 
 * This is the original animation style:
 * - Active cells shrink their height (vertical) or width (horizontal)
 * - Size is proportional to contribution level
 * - Cells slide to form stacked bar charts
 */

const {
  BaseCellRenderer,
  CELL_SIZE,
  LEVEL_COLORS
} = require('./base-renderer');

class RectCellRenderer extends BaseCellRenderer {
  constructor(config, theme = 'light') {
    super(config, theme);
  }

  getName() {
    return 'rectangle';
  }

  getCellStackHeight(day) {
    return Math.round(day.heightMultiplier * CELL_SIZE);
  }

  getCellStackWidth(day) {
    return Math.round(day.heightMultiplier * CELL_SIZE);
  }

  renderEmptyCell(x, y, color) {
    const V = this.vCycle.times;
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    
    // Build mode-aware keyframes
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
          // Already hidden from V cycle, just extend to H.holdEnd
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

  renderActiveCell(cellData) {
    const { x, y, color, vY, vH, hX, hW, staggerDelay, vLandingTime, hLandingTime } = cellData;
    const V = this.vCycle.times;
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    
    const vMidY = y + (CELL_SIZE - vH);
    
    // Build mode-aware keyframes
    const keyTimesArr = [];
    const yValsArr = [];
    const hValsArr = []; // height
    const xValsArr = [];
    const wValsArr = []; // width
    const cValsArr = []; // color
    const rValsArr = []; // radius
    
    if (this.includeVertical) {
      const vDelay = this.stagger.enabled ? staggerDelay : 0;
      const vStackDur = this.timing.vStackDur;
      const vStackStart = V.transformEnd + vDelay;
      const vStackFinish = (this.stack.growOnJoin && vLandingTime) ? vLandingTime : vStackStart + vStackDur;
      
      if (forwardOnly) {
        // Forward-only: grid → transform → stack → hold (end at stacked position)
        keyTimesArr.push(V.start, V.transformStart, V.transformEnd, vStackStart, vStackFinish, V.holdEnd);
        yValsArr.push(y, y, vMidY, vMidY, vY, vY);
        hValsArr.push(CELL_SIZE, CELL_SIZE, vH, vH, vH, vH);
        xValsArr.push(x, x, x, x, x, x);
        wValsArr.push(CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE);
        cValsArr.push(color, color, this.barColor, this.barColor, this.barColor, this.barColor);
        rValsArr.push(2, 2, 0, 0, 0, 0);
      } else {
        const vReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const vUnstackStart = V.holdEnd + vReverseDelay;
        const vUnstackFinish = vUnstackStart + vStackDur;
        
        // Full cycle (10 points)
        keyTimesArr.push(V.start, V.transformStart, V.transformEnd, vStackStart, vStackFinish, V.holdEnd, vUnstackStart, vUnstackFinish, V.untransformEnd, V.end);
        yValsArr.push(y, y, vMidY, vMidY, vY, vY, vY, vMidY, y, y);
        hValsArr.push(CELL_SIZE, CELL_SIZE, vH, vH, vH, vH, vH, vH, CELL_SIZE, CELL_SIZE);
        xValsArr.push(x, x, x, x, x, x, x, x, x, x);
        wValsArr.push(CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE);
        cValsArr.push(color, color, this.barColor, this.barColor, this.barColor, this.barColor, this.barColor, this.barColor, color, color);
        rValsArr.push(2, 2, 0, 0, 0, 0, 0, 0, 2, 2);
      }
    } else {
      keyTimesArr.push(0);
      yValsArr.push(y);
      hValsArr.push(CELL_SIZE);
      xValsArr.push(x);
      wValsArr.push(CELL_SIZE);
      cValsArr.push(color);
      rValsArr.push(2);
    }
    
    if (this.includeHorizontal) {
      const hDelay = this.stagger.enabled ? staggerDelay : 0;
      const hStackDur = this.timing.vStackDur * this.timing.hSpeedMult;
      const hStackStart = H.transformEnd + hDelay;
      const hStackFinish = (this.stack.growOnJoin && hLandingTime) ? hLandingTime : hStackStart + hStackDur;
      
      if (forwardOnly) {
        // Forward-only: grid → transform → stack → hold (end at stacked position)
        keyTimesArr.push(H.transformStart, H.transformEnd, hStackStart, hStackFinish, H.holdEnd);
        yValsArr.push(y, y, y, y, y);
        hValsArr.push(CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE);
        xValsArr.push(x, x, x, hX, hX);
        wValsArr.push(CELL_SIZE, hW, hW, hW, hW);
        cValsArr.push(color, this.barColor, this.barColor, this.barColor, this.barColor);
        rValsArr.push(2, 0, 0, 0, 0);
      } else {
        const hReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const hUnstackStart = H.holdEnd + hReverseDelay;
        const hUnstackFinish = hUnstackStart + hStackDur;
        
        // H cycle keyframes (9 points)
        keyTimesArr.push(H.transformStart, H.transformEnd, hStackStart, hStackFinish, H.holdEnd, hUnstackStart, hUnstackFinish, H.untransformEnd, H.end);
        yValsArr.push(y, y, y, y, y, y, y, y, y);
        hValsArr.push(CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE);
        xValsArr.push(x, x, x, hX, hX, hX, x, x, x);
        wValsArr.push(CELL_SIZE, hW, hW, hW, hW, hW, hW, CELL_SIZE, CELL_SIZE);
        cValsArr.push(color, this.barColor, this.barColor, this.barColor, this.barColor, this.barColor, this.barColor, color, color);
        rValsArr.push(2, 0, 0, 0, 0, 0, 0, 2, 2);
      }
    } else if (!forwardOnly) {
      keyTimesArr.push(this.totalDuration);
      yValsArr.push(y);
      hValsArr.push(CELL_SIZE);
      xValsArr.push(x);
      wValsArr.push(CELL_SIZE);
      cValsArr.push(color);
      rValsArr.push(2);
    }
    
    const keyTimes = keyTimesArr.map(t => this.f(t)).join('; ');
    const yVals = yValsArr.join('; ');
    const hVals = hValsArr.join('; ');
    const xVals = xValsArr.join('; ');
    const wVals = wValsArr.join('; ');
    const cVals = cValsArr.join('; ');
    const rVals = rValsArr.join('; ');
    
    // Build opacity animation (mode-aware)
    const opKeyArr = [];
    const opValsArr = [];
    
    if (this.includeVertical) {
      const vDelay = this.stagger.enabled ? staggerDelay : 0;
      const vStackDur = this.timing.vStackDur;
      const vStackStart = V.transformEnd + vDelay;
      const vStackFinish = (this.stack.growOnJoin && vLandingTime) ? vLandingTime : vStackStart + vStackDur;
      const vLand = vLandingTime || vStackFinish;
      
      if (forwardOnly) {
        if (this.stack.growOnJoin) {
          opKeyArr.push(V.start, Math.max(V.start, vLand - 0.001), vLand, V.holdEnd);
          opValsArr.push(1, 1, 0, 0);  // Disappear when landing, stay hidden
        } else {
          opKeyArr.push(V.start, V.holdEnd);
          opValsArr.push(1, 1);  // Stay visible at stacked position
        }
      } else {
        const vReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const vUnstackStart = V.holdEnd + vReverseDelay;
        
        if (this.stack.growOnJoin) {
          opKeyArr.push(V.start, Math.max(V.start, vLand - 0.001), vLand, vUnstackStart, vUnstackStart + 0.001, V.end);
          opValsArr.push(1, 1, 0, 0, 1, 1);
        } else {
          const solidFadeTime = 0.15;
          opKeyArr.push(V.start, vStackFinish, vStackFinish + solidFadeTime, V.holdEnd - solidFadeTime, V.holdEnd, V.end);
          opValsArr.push(1, 1, 0, 0, 1, 1);
        }
      }
    } else {
      opKeyArr.push(0);
      opValsArr.push(1);
    }
    
    if (this.includeHorizontal) {
      const hDelay = this.stagger.enabled ? staggerDelay : 0;
      const hStackDur = this.timing.vStackDur * this.timing.hSpeedMult;
      const hStackStart = H.transformEnd + hDelay;
      const hStackFinish = (this.stack.growOnJoin && hLandingTime) ? hLandingTime : hStackStart + hStackDur;
      const hLand = hLandingTime || hStackFinish;
      
      if (forwardOnly) {
        if (this.stack.growOnJoin) {
          opKeyArr.push(Math.max(H.start, hLand - 0.001), hLand, H.holdEnd);
          opValsArr.push(1, 0, 0);  // Disappear when landing, stay hidden
        } else {
          opKeyArr.push(H.transformStart, H.holdEnd);
          opValsArr.push(1, 1);  // Stay visible at stacked position
        }
      } else {
        const hReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const hUnstackStart = H.holdEnd + hReverseDelay;
        
        if (this.stack.growOnJoin) {
          opKeyArr.push(Math.max(H.start, hLand - 0.001), hLand, hUnstackStart, hUnstackStart + 0.001, H.end);
          opValsArr.push(1, 0, 0, 1, 1);
        } else {
          const solidFadeTime = 0.15;
          opKeyArr.push(hStackFinish, hStackFinish + solidFadeTime, H.holdEnd - solidFadeTime, H.holdEnd, H.end);
          opValsArr.push(1, 0, 0, 1, 1);
        }
      }
    } else if (!forwardOnly) {
      opKeyArr.push(this.totalDuration);
      opValsArr.push(1);
    }
    
    const opKeyTimes = opKeyArr.map(t => this.f(t)).join('; ');
    const opVals = opValsArr.join('; ');

    return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${color}">
    <animate attributeName="y" values="${yVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="height" values="${hVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="x" values="${xVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="width" values="${wVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="fill" values="${cVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="rx" values="${rVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="ry" values="${rVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="opacity" values="${opVals}" keyTimes="${opKeyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
  }

  renderVerticalBar(x, y, w, h, landingData = null) {
    const V = this.vCycle.times;
    const solidFadeTime = 0.15;
    const forwardOnly = !this.loop;
    const bottomY = y + h;
    
    if (this.stack.growOnJoin && landingData && landingData.length > 0) {
      // STEPPED GROWTH: bar grows in steps as each cell lands
      const keyTimesArr = [this.f(0), this.f(V.transformEnd)];
      const heightValsArr = [0, 0];
      const yValsArr = [bottomY, bottomY];
      
      landingData.forEach((d, i) => {
        const t = d.landingTime;
        const prevHeight = i === 0 ? 0 : landingData[i - 1].cumulativeHeight;
        
        if (t > V.transformEnd) {
          keyTimesArr.push(this.f(t - 0.001));
          heightValsArr.push(prevHeight);
          yValsArr.push(bottomY - prevHeight);
        }
        
        keyTimesArr.push(this.f(t));
        heightValsArr.push(d.cumulativeHeight);
        yValsArr.push(bottomY - d.cumulativeHeight);
      });
      
      // Hold at full height
      keyTimesArr.push(this.f(V.holdEnd));
      heightValsArr.push(h);
      yValsArr.push(y);
      
      if (!forwardOnly) {
        // Shrink back
        keyTimesArr.push(this.f(V.unstackEnd));
        heightValsArr.push(0);
        yValsArr.push(bottomY);
        
        keyTimesArr.push(this.f(this.totalDuration));
        heightValsArr.push(0);
        yValsArr.push(bottomY);
      } else {
        // Forward-only: hold at full height until end
        keyTimesArr.push(this.f(this.totalDuration));
        heightValsArr.push(h);
        yValsArr.push(y);
      }
      
      const keyTimes = keyTimesArr.join('; ');
      const heightVals = heightValsArr.join('; ');
      const yVals = yValsArr.join('; ');
      
      return `<rect x="${x}" y="${bottomY}" width="${w}" height="0" fill="${this.barColor}">
    <animate attributeName="y" values="${yVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="height" values="${heightVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    } else if (this.stack.growOnJoin) {
      // Fallback: linear growth
      let keyTimes, heightVals, yVals;
      
      if (forwardOnly) {
        keyTimes = [
          this.f(0), 
          this.f(V.transformEnd),
          this.f(V.stackEnd),
          this.f(V.holdEnd),
          this.f(this.totalDuration)
        ].join('; ');
        heightVals = [0, 0, h, h, h].join('; ');
        yVals = [bottomY, bottomY, y, y, y].join('; ');
      } else {
        keyTimes = [
          this.f(0), 
          this.f(V.transformEnd),
          this.f(V.stackEnd),
          this.f(V.holdEnd),
          this.f(V.unstackEnd),
          this.f(this.totalDuration)
        ].join('; ');
        heightVals = [0, 0, h, h, 0, 0].join('; ');
        yVals = [bottomY, bottomY, y, y, bottomY, bottomY].join('; ');
      }
      
      return `<rect x="${x}" y="${bottomY}" width="${w}" height="0" fill="${this.barColor}">
    <animate attributeName="y" values="${yVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="height" values="${heightVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    } else {
      // Original behavior: just fade in/out
      let keyTimes, opVals;
      
      if (forwardOnly) {
        keyTimes = [
          this.f(0), this.f(V.stackEnd), this.f(V.stackEnd + solidFadeTime), this.f(V.holdEnd), this.f(this.totalDuration)
        ].join('; ');
        opVals = '0; 0; 1; 1; 1';
      } else {
        keyTimes = [
          this.f(0), this.f(V.stackEnd), this.f(V.stackEnd + solidFadeTime), 
          this.f(V.holdEnd - solidFadeTime), this.f(V.holdEnd), this.f(this.totalDuration)
        ].join('; ');
        opVals = '0; 0; 1; 1; 0; 0';
      }
      
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.barColor}">
    <animate attributeName="opacity" values="${opVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    }
  }

  renderHorizontalBar(x, y, w, h, landingData = null) {
    const H = this.hCycle.times;
    const solidFadeTime = 0.15;
    const forwardOnly = !this.loop;
    
    if (this.stack.growOnJoin && landingData && landingData.length > 0) {
      // STEPPED GROWTH: bar grows in steps as each cell lands
      const keyTimesArr = [this.f(0), this.f(H.transformEnd)];
      const widthValsArr = [0, 0];
      
      landingData.forEach((d, i) => {
        const t = d.landingTime;
        const prevWidth = i === 0 ? 0 : landingData[i - 1].cumulativeWidth;
        
        if (t > H.transformEnd) {
          keyTimesArr.push(this.f(t - 0.001));
          widthValsArr.push(prevWidth);
        }
        
        keyTimesArr.push(this.f(t));
        widthValsArr.push(d.cumulativeWidth);
      });
      
      // Hold at full width
      keyTimesArr.push(this.f(H.holdEnd));
      widthValsArr.push(w);
      
      if (!forwardOnly) {
        // Shrink back
        keyTimesArr.push(this.f(H.unstackEnd));
        widthValsArr.push(0);
        
        keyTimesArr.push(this.f(this.totalDuration));
        widthValsArr.push(0);
      } else {
        // Forward-only: hold at full width until end
        keyTimesArr.push(this.f(this.totalDuration));
        widthValsArr.push(w);
      }
      
      const keyTimes = keyTimesArr.join('; ');
      const widthVals = widthValsArr.join('; ');
      
      return `<rect x="${x}" y="${y}" width="0" height="${h}" fill="${this.barColor}">
    <animate attributeName="width" values="${widthVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    } else if (this.stack.growOnJoin) {
      // Fallback: linear growth
      let keyTimes, widthVals;
      
      if (forwardOnly) {
        keyTimes = [
          this.f(0), 
          this.f(H.transformEnd),
          this.f(H.stackEnd),
          this.f(H.holdEnd),
          this.f(this.totalDuration)
        ].join('; ');
        widthVals = [0, 0, w, w, w].join('; ');
      } else {
        keyTimes = [
          this.f(0), 
          this.f(H.transformEnd),
          this.f(H.stackEnd),
          this.f(H.holdEnd),
          this.f(H.unstackEnd),
          this.f(this.totalDuration)
        ].join('; ');
        widthVals = [0, 0, w, w, 0, 0].join('; ');
      }
      
      return `<rect x="${x}" y="${y}" width="0" height="${h}" fill="${this.barColor}">
    <animate attributeName="width" values="${widthVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    } else {
      // Original behavior: just fade in/out
      let keyTimes, opVals;
      
      if (forwardOnly) {
        keyTimes = [
          this.f(0), this.f(H.stackEnd), this.f(H.stackEnd + solidFadeTime), this.f(H.holdEnd), this.f(this.totalDuration)
        ].join('; ');
        opVals = '0; 0; 1; 1; 1';
      } else {
        keyTimes = [
          this.f(0), this.f(H.stackEnd), this.f(H.stackEnd + solidFadeTime), 
          this.f(H.holdEnd - solidFadeTime), this.f(H.holdEnd), this.f(this.totalDuration)
        ].join('; ');
        opVals = '0; 0; 1; 1; 0; 0';
      }
      
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.barColor}">
    <animate attributeName="opacity" values="${opVals}" keyTimes="${keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
    }
  }
}

module.exports = { RectCellRenderer };
