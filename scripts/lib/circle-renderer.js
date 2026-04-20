/**
 * CircleCellRenderer - Morphs grid rects into circles via animated rx/ry
 * Level 1=small, Level 2=medium, Level 3=large, Level 4=full size
 */

const {
  BaseCellRenderer,
  CELL_SIZE,
  LEVEL_TO_MULTIPLIER
} = require('./base-renderer');
const { AnimationTimeline } = require('./animation-timeline');

// Maximum circle radius (half the cell, with small inset)
const MAX_RADIUS = CELL_SIZE / 2;

class CircleCellRenderer extends BaseCellRenderer {
  getName() {
    return 'circles';
  }

  renderActiveCell(cellData) {
    const { x, y, color, vY, vH, vTotalHeight, vGridBottom, hX, hTotalWidth, hGridLeft, level, vLandingTime, hLandingTime, vPrevCumulativeHeight, vCumulativeHeight, hPrevCumulativeWidth, hCumulativeWidth } = cellData;
    const V = this.vCycle.times;
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    
    const multiplier = LEVEL_TO_MULTIPLIER[level] || 0;
    if (multiplier === 0) return this.renderEmptyCell(x, y, color);
    
    const radius = Math.round(Math.sqrt(multiplier) * MAX_RADIUS * 10) / 10;
    const diameter = radius * 2;
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;

    // Circle state (rect that looks like a circle): centered in cell
    const circleX = cx - radius;
    const circleY = cy - radius;

    // Stacked positions (as rect top-left)
    let vArrivalY = circleY, vDepartureY = circleY;
    let hArrivalX = circleX, hArrivalY = circleY;
    let hDepartureX = circleX, hDepartureY = circleY;
    
    if (this.includeVertical) {
      vArrivalY = vGridBottom - (vPrevCumulativeHeight || 0) - diameter;
      vDepartureY = vGridBottom - (vCumulativeHeight || 0);
    }
    
    if (this.includeHorizontal) {
      hArrivalX = hGridLeft + (hPrevCumulativeWidth || 0);
      hArrivalY = circleY;
      hDepartureX = hGridLeft + (hCumulativeWidth || 0) - diameter;
      hDepartureY = circleY;
    }

    // Animation states as rect properties
    const grid       = { x, y, width: CELL_SIZE, height: CELL_SIZE, rx: 2, fill: color };
    const circle     = { x: circleX, y: circleY, width: diameter, height: diameter, rx: radius, fill: this.barColor };
    const vArrival   = { x: circleX, y: vArrivalY, width: diameter, height: diameter, rx: radius, fill: this.barColor };
    const vDeparture = { x: circleX, y: vDepartureY, width: diameter, height: diameter, rx: radius, fill: this.barColor };
    const hArrival   = { x: hArrivalX, y: hArrivalY, width: diameter, height: diameter, rx: radius, fill: this.barColor };
    const hDeparture = { x: hDepartureX, y: hDepartureY, width: diameter, height: diameter, rx: radius, fill: this.barColor };

    const mainFrames = [];
    const opKeyArr = [];
    const opValsArr = [];
    
    if (this.includeVertical) {
      const vStackDur = this.timing.vStackDur;
      const vStackStart = V.transformEnd;
      const vStackFinish = vLandingTime || (vStackStart + vStackDur);
      
      if (forwardOnly) {
        mainFrames.push(
          { time: V.start, props: grid },
          { time: V.transformStart, props: grid },
          { time: V.transformEnd, props: circle },
          { time: vStackStart, props: circle },
          { time: vStackFinish, props: vArrival },
          { time: V.holdEnd, props: vArrival }
        );
        opKeyArr.push(V.start, Math.max(V.start, vStackFinish - 0.001), vStackFinish, V.holdEnd);
        opValsArr.push(1, 1, 0, 0);
      } else {
        let vUnstackStart, vUnstackFinish;
        if (vLandingTime) {
          const stackDur = V.stackEnd - V.transformEnd;
          const unstackDur = V.unstackEnd - V.holdEnd;
          const landingFraction = stackDur > 0 ? (vLandingTime - V.transformEnd) / stackDur : 0;
          const departFraction = 1 - landingFraction;
          vUnstackStart = V.holdEnd + departFraction * unstackDur;
          vUnstackFinish = V.unstackEnd;
        } else {
          vUnstackStart = V.holdEnd;
          vUnstackFinish = vUnstackStart + vStackDur;
        }
        
        mainFrames.push(
          { time: V.start, props: grid },
          { time: V.transformStart, props: grid },
          { time: V.transformEnd, props: circle },
          { time: vStackStart, props: circle },
          { time: vStackFinish, props: vArrival },
          { time: V.holdEnd, props: vDeparture },
          { time: vUnstackStart, props: vDeparture },
          { time: vUnstackFinish, props: circle },
          { time: V.unstackEnd, props: circle },
          { time: V.untransformEnd, props: grid },
          { time: V.end, props: grid }
        );
        opKeyArr.push(V.start, Math.max(V.start, vStackFinish - 0.001), vStackFinish, vUnstackStart, vUnstackStart + 0.001, V.end);
        opValsArr.push(1, 1, 0, 0, 1, 1);
      }
    } else {
      mainFrames.push({ time: 0, props: grid });
      opKeyArr.push(0);
      opValsArr.push(1);
    }
    
    if (this.includeHorizontal) {
      const hStackDur = this.timing.vStackDur * this.timing.hSpeedMult;
      const hStackStart = H.transformEnd;
      const hStackFinish = hLandingTime || (hStackStart + hStackDur);
      
      if (forwardOnly) {
        mainFrames.push(
          { time: H.transformStart, props: circle },
          { time: H.transformEnd, props: circle },
          { time: hStackStart, props: circle },
          { time: hStackFinish, props: hArrival },
          { time: H.holdEnd, props: hArrival }
        );
        opKeyArr.push(Math.max(H.start, hStackFinish - 0.001), hStackFinish, H.holdEnd);
        opValsArr.push(1, 0, 0);
      } else {
        let hUnstackStart, hUnstackFinish;
        if (hLandingTime) {
          const stackDur = H.stackEnd - H.transformEnd;
          const unstackDur = H.unstackEnd - H.holdEnd;
          const landingFraction = stackDur > 0 ? (hLandingTime - H.transformEnd) / stackDur : 0;
          const departFraction = 1 - landingFraction;
          hUnstackStart = H.holdEnd + departFraction * unstackDur;
          hUnstackFinish = H.unstackEnd;
        } else {
          hUnstackStart = H.holdEnd;
          hUnstackFinish = hUnstackStart + hStackDur;
        }
        
        mainFrames.push(
          { time: H.transformStart, props: circle },
          { time: H.transformEnd, props: circle },
          { time: hStackStart, props: circle },
          { time: hStackFinish, props: hArrival },
          { time: H.holdEnd, props: hDeparture },
          { time: hUnstackStart, props: hDeparture },
          { time: hUnstackFinish, props: circle },
          { time: H.unstackEnd, props: circle },
          { time: H.untransformEnd, props: grid },
          { time: H.end, props: grid }
        );
        opKeyArr.push(Math.max(H.start, hStackFinish - 0.001), hStackFinish, hUnstackStart, hUnstackStart + 0.001, H.end);
        opValsArr.push(1, 0, 0, 1, 1);
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
    <animate attributeName="x" values="${main.x.values}" keyTimes="${main.x.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="y" values="${main.y.values}" keyTimes="${main.y.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="width" values="${main.width.values}" keyTimes="${main.width.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="height" values="${main.height.values}" keyTimes="${main.height.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="rx" values="${main.rx.values}" keyTimes="${main.rx.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="ry" values="${main.rx.values}" keyTimes="${main.rx.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="fill" values="${main.fill.values}" keyTimes="${main.fill.keyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
    <animate attributeName="opacity" values="${opVals}" keyTimes="${opKeyTimes}" dur="${this.totalDuration}s" repeatCount="${this.repeatCount}"${this.fillFreeze}/>
  </rect>`;
  }

  renderVerticalBar(x, y, w, h, landingData = null) {
    const V = this.vCycle.times;
    const bottomY = y + h;
    const forwardOnly = !this.loop;
    
    if (landingData && landingData.length > 0) {
      // STEPPED GROWTH: bar grows in steps as each cell's circles land
      const keyTimesArr = [this.f(0), this.f(V.transformEnd)];
      const heightValsArr = [0, 0];
      const yValsArr = [bottomY, bottomY];
      
      landingData.forEach((d, i) => {
        const t = d.landingTime;
        const prevHeight = i === 0 ? 0 : landingData[i - 1].cumulativeHeight;
        
        // Just before landing - still at previous height
        if (t > V.transformEnd) {
          keyTimesArr.push(this.f(t - 0.001));
          heightValsArr.push(prevHeight);
          yValsArr.push(bottomY - prevHeight);
        }
        
        // At landing - jump to new height
        keyTimesArr.push(this.f(t));
        heightValsArr.push(d.cumulativeHeight);
        yValsArr.push(bottomY - d.cumulativeHeight);
      });
      
      // Hold at full height
      keyTimesArr.push(this.f(V.holdEnd));
      heightValsArr.push(h);
      yValsArr.push(y);
      
      if (!forwardOnly) {
        // Add shrink animation only if looping
        {
          // STEPPED SHRINK: bar shrinks in steps as circles depart (reverse order - last landed leaves first)
          const unstackDur = V.unstackEnd - V.holdEnd;
          const stackDur = V.stackEnd - V.transformEnd;
          
          const reversedData = [...landingData].reverse();
          reversedData.forEach((d, i) => {
            const landingFraction = (d.landingTime - V.transformEnd) / stackDur;
            const departFraction = 1 - landingFraction;
            const departTime = V.holdEnd + departFraction * unstackDur;
            
            const remainingHeight = i === reversedData.length - 1 ? 0 : reversedData[i + 1].cumulativeHeight;
            const prevHeight = i === 0 ? h : reversedData[i].cumulativeHeight;
            
            if (departTime > V.holdEnd) {
              keyTimesArr.push(this.f(departTime - 0.001));
              heightValsArr.push(prevHeight);
              yValsArr.push(bottomY - prevHeight);
            }
            
            keyTimesArr.push(this.f(departTime));
            heightValsArr.push(remainingHeight);
            yValsArr.push(bottomY - remainingHeight);
          });
        }
        
        // Ensure we end at zero
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
    }
    
    // Fallback: pop at stackEnd
    let keyTimes, heightVals, yVals;
    
    if (forwardOnly) {
      keyTimes = [
        this.f(0), 
        this.f(V.stackEnd - 0.001),
        this.f(V.stackEnd),
        this.f(V.holdEnd),
        this.f(this.totalDuration)
      ].join('; ');
      heightVals = [0, 0, h, h, h].join('; ');
      yVals = [bottomY, bottomY, y, y, y].join('; ');
    } else {
      keyTimes = [
        this.f(0), 
        this.f(V.stackEnd - 0.001),
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
  }

  renderHorizontalBar(x, y, w, h, landingData = null) {
    const H = this.hCycle.times;
    const forwardOnly = !this.loop;
    
    if (landingData && landingData.length > 0) {
      // STEPPED GROWTH: bar grows in steps as each cell's circles land
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
      
      keyTimesArr.push(this.f(H.holdEnd));
      widthValsArr.push(w);
      
      if (!forwardOnly) {
        // Add shrink animation only if looping
        {
          // STEPPED SHRINK: bar shrinks in steps as circles depart (reverse order)
          const unstackDur = H.unstackEnd - H.holdEnd;
          const stackDur = H.stackEnd - H.transformEnd;
          
          const reversedData = [...landingData].reverse();
          reversedData.forEach((d, i) => {
            const landingFraction = (d.landingTime - H.transformEnd) / stackDur;
            const departFraction = 1 - landingFraction;
            const departTime = H.holdEnd + departFraction * unstackDur;
            
            const remainingWidth = i === reversedData.length - 1 ? 0 : reversedData[i + 1].cumulativeWidth;
            const prevWidth = i === 0 ? w : reversedData[i].cumulativeWidth;
            
            if (departTime > H.holdEnd) {
              keyTimesArr.push(this.f(departTime - 0.001));
              widthValsArr.push(prevWidth);
            }
            
            keyTimesArr.push(this.f(departTime));
            widthValsArr.push(remainingWidth);
          });
        }
        
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
    }
    
    // Fallback: pop at stackEnd
    let keyTimes, widthVals;
    
    if (forwardOnly) {
      keyTimes = [
        this.f(0), 
        this.f(H.stackEnd - 0.001),
        this.f(H.stackEnd),
        this.f(H.holdEnd),
        this.f(this.totalDuration)
      ].join('; ');
      widthVals = [0, 0, w, w, w].join('; ');
    } else {
      keyTimes = [
        this.f(0), 
        this.f(H.stackEnd - 0.001),
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
  }
}

module.exports = { CircleCellRenderer };
