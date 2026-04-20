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
  CELL_SIZE
} = require('./base-renderer');
const { AnimationTimeline } = require('./animation-timeline');

class RectCellRenderer extends BaseCellRenderer {
  getName() {
    return 'rectangle';
  }

  renderActiveCell(cellData) {
    const { x, y, color, vY, vH, hX, hW, staggerDelay, vLandingTime, hLandingTime } = cellData;
    const V = this.vCycle.times;
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    const vMidY = y + (CELL_SIZE - vH);

    // Animation states
    const grid     = { y, height: CELL_SIZE, x, width: CELL_SIZE, fill: color, r: 2 };
    const vShrunk  = { y: vMidY, height: vH, x, width: CELL_SIZE, fill: this.barColor, r: 0 };
    const vStacked = { y: vY, height: vH, x, width: CELL_SIZE, fill: this.barColor, r: 0 };
    const hShrunk  = { y, height: CELL_SIZE, x, width: hW, fill: this.barColor, r: 0 };
    const hStacked = { y, height: CELL_SIZE, x: hX, width: hW, fill: this.barColor, r: 0 };

    const mainFrames = [];
    const opKeyArr = [];
    const opValsArr = [];

    if (this.includeVertical) {
      const vDelay = this.stagger.enabled ? staggerDelay : 0;
      const vStackDur = this.timing.vStackDur;
      const vStackStart = V.transformEnd + vDelay;
      const vStackFinish = (this.stack.growOnJoin && vLandingTime) ? vLandingTime : vStackStart + vStackDur;
      const vLand = vLandingTime || vStackFinish;

      if (forwardOnly) {
        mainFrames.push(
          { time: V.start, props: grid },
          { time: V.transformStart, props: grid },
          { time: V.transformEnd, props: vShrunk },
          { time: vStackStart, props: vShrunk },
          { time: vStackFinish, props: vStacked },
          { time: V.holdEnd, props: vStacked }
        );
        if (this.stack.growOnJoin) {
          opKeyArr.push(V.start, Math.max(V.start, vLand - 0.001), vLand, V.holdEnd);
          opValsArr.push(1, 1, 0, 0);
        } else {
          opKeyArr.push(V.start, V.holdEnd);
          opValsArr.push(1, 1);
        }
      } else {
        const vReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const vUnstackStart = V.holdEnd + vReverseDelay;
        const vUnstackFinish = vUnstackStart + vStackDur;

        mainFrames.push(
          { time: V.start, props: grid },
          { time: V.transformStart, props: grid },
          { time: V.transformEnd, props: vShrunk },
          { time: vStackStart, props: vShrunk },
          { time: vStackFinish, props: vStacked },
          { time: V.holdEnd, props: vStacked },
          { time: vUnstackStart, props: vStacked },
          { time: vUnstackFinish, props: vShrunk },
          { time: V.untransformEnd, props: grid },
          { time: V.end, props: grid }
        );
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
      mainFrames.push({ time: 0, props: grid });
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
        mainFrames.push(
          { time: H.transformStart, props: grid },
          { time: H.transformEnd, props: hShrunk },
          { time: hStackStart, props: hShrunk },
          { time: hStackFinish, props: hStacked },
          { time: H.holdEnd, props: hStacked }
        );
        if (this.stack.growOnJoin) {
          opKeyArr.push(Math.max(H.start, hLand - 0.001), hLand, H.holdEnd);
          opValsArr.push(1, 0, 0);
        } else {
          opKeyArr.push(H.transformStart, H.holdEnd);
          opValsArr.push(1, 1);
        }
      } else {
        const hReverseDelay = this.stagger.enabled ? (this.stagger.maxDelay - staggerDelay) : 0;
        const hUnstackStart = H.holdEnd + hReverseDelay;
        const hUnstackFinish = hUnstackStart + hStackDur;

        mainFrames.push(
          { time: H.transformStart, props: grid },
          { time: H.transformEnd, props: hShrunk },
          { time: hStackStart, props: hShrunk },
          { time: hStackFinish, props: hStacked },
          { time: H.holdEnd, props: hStacked },
          { time: hUnstackStart, props: hStacked },
          { time: hUnstackFinish, props: hShrunk },
          { time: H.untransformEnd, props: grid },
          { time: H.end, props: grid }
        );
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
      mainFrames.push({ time: this.totalDuration, props: grid });
      opKeyArr.push(this.totalDuration);
      opValsArr.push(1);
    }

    const main = AnimationTimeline.fromKeyframes(this.totalDuration, mainFrames);
    const opKeyTimes = opKeyArr.map(t => this.f(t)).join('; ');
    const opVals = opValsArr.join('; ');

    return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${color}">
    <animate attributeName="y" values="${main.y.values}" keyTimes="${main.y.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="height" values="${main.height.values}" keyTimes="${main.height.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="x" values="${main.x.values}" keyTimes="${main.x.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="width" values="${main.width.values}" keyTimes="${main.width.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="fill" values="${main.fill.values}" keyTimes="${main.fill.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="rx" values="${main.r.values}" keyTimes="${main.r.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="ry" values="${main.r.values}" keyTimes="${main.r.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
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
