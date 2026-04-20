#!/usr/bin/env node

/**
 * Generates an animated SVG that transforms the GitHub contribution grid
 * into bar charts - alternating between vertical (weeks) and horizontal (days)
 * 
 * Animation sequence (per cycle):
 * 1. Show grid with original colors
 * 2. Empty cells fade out; active cells transform (shrink or become circles)
 * 3. Transformed elements slide and stack together (with optional stagger)
 * 4. Hold at stacked position
 * 5. Reverse: unstack, un-transform, fade in empty cells
 * 
 * Configuration can be set via config.json or environment variables.
 * 
 * Supports multiple transform styles:
 * - 'shrink': Original style - rectangles shrink proportionally
 * - 'circles': Cells become 1-4 circles in a 2x2 grid pattern
 */

const fs = require('fs');
const path = require('path');
const { getRenderer, getAvailableStyles } = require('./lib');
const { CELL_SIZE, CELL_GAP, CELL_TOTAL, DAYS_IN_WEEK, getLevelColors } = require('./lib/base-renderer');

// Labels
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============ CONFIGURATION ============

function loadConfig() {
  // Default config
  const defaults = {
    animation: {
      speed: 'fast',
      mode: 'both',
      loop: true
    },
    stagger: {
      enabled: false,
      order: 'left-to-right',
      maxDelay: 0.5
    },
    transform: {
      style: 'rectangle'
    },
    stack: {
      growOnJoin: true,
      steppedReverse: true
    },
    colors: {
      barColor: '#216e39'
    }
  };

  // Try to load config.json
  const configPath = path.join(__dirname, '..', 'config.json');
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      fileConfig = raw;
    } catch (e) {
      console.warn('Warning: Could not parse config.json, using defaults');
    }
  }

  // Merge with defaults
  const config = {
    animation: { ...defaults.animation, ...fileConfig.animation },
    stagger: { ...defaults.stagger, ...fileConfig.stagger },
    transform: { ...defaults.transform, ...fileConfig.transform },
    stack: { ...defaults.stack, ...fileConfig.stack },
    colors: { ...defaults.colors, ...fileConfig.colors }
  };

  // Environment variable overrides (for GitHub Actions)
  if (process.env.SVG_SPEED) config.animation.speed = process.env.SVG_SPEED;
  if (process.env.SVG_MODE) config.animation.mode = process.env.SVG_MODE;
  if (process.env.SVG_LOOP) config.animation.loop = process.env.SVG_LOOP === 'true';
  if (process.env.SVG_STAGGER_ENABLED) config.stagger.enabled = process.env.SVG_STAGGER_ENABLED === 'true';
  if (process.env.SVG_STAGGER_ORDER) config.stagger.order = process.env.SVG_STAGGER_ORDER;
  if (process.env.SVG_STAGGER_MAX_DELAY) config.stagger.maxDelay = parseFloat(process.env.SVG_STAGGER_MAX_DELAY);
  if (process.env.SVG_TRANSFORM_STYLE) config.transform.style = process.env.SVG_TRANSFORM_STYLE;
  if (process.env.SVG_GROW_ON_JOIN) config.stack.growOnJoin = process.env.SVG_GROW_ON_JOIN === 'true';
  if (process.env.SVG_BAR_COLOR) config.colors.barColor = process.env.SVG_BAR_COLOR;

  return config;
}

// ============ HELPER FUNCTIONS ============

function getMonthLabels(weeks, paddingLeft) {
  const labels = [];
  let currentMonth = -1;
  
  weeks.forEach((week, weekIndex) => {
    const firstDay = week.days[0];
    if (!firstDay || !firstDay.date) return;
    
    const date = new Date(firstDay.date);
    const month = date.getMonth();
    
    if (month !== currentMonth) {
      currentMonth = month;
      labels.push({
        text: MONTH_NAMES[month],
        x: paddingLeft + weekIndex * CELL_TOTAL
      });
    }
  });
  
  return labels;
}

// ============ MAIN GENERATION ============

function generateSVG(contributionData, config, theme = 'light') {
  const { weeks } = contributionData;
  const numWeeks = weeks.length;
  const LEVEL_COLORS = getLevelColors(theme);
  
  // Get renderer based on transform style
  const renderer = getRenderer(config.transform.style, config, theme);
  const timingInfo = renderer.getTimingInfo();
  
  // Layout
  const dayLabelWidth = 30;
  const paddingTop = 20;
  const paddingRight = 20;
  const paddingBottom = 20;
  const paddingLeft = 20 + dayLabelWidth;
  const labelHeight = 20;
  
  const gridWidth = numWeeks * CELL_TOTAL;
  const gridHeight = DAYS_IN_WEEK * CELL_TOTAL;
  const svgWidth = paddingLeft + gridWidth + paddingRight;
  const svgHeight = paddingTop + labelHeight + gridHeight + paddingBottom;
  
  const gridLeft = paddingLeft;
  const gridTop = paddingTop + labelHeight;
  const gridBottom = gridTop + gridHeight;

  // Calculate stacks using renderer's methods
  const weekStacks = renderer.calculateVerticalStacks(weeks);
  const dayStacks = renderer.calculateHorizontalStacks(weeks);

  // Labels
  const monthLabels = getMonthLabels(weeks, gridLeft);
  const monthLabelElements = monthLabels.map(label => 
    `<text x="${label.x}" y="${paddingTop + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#57606a">${label.text}</text>`
  );
  
  const dayLabelElements = DAY_NAMES.map((name, i) => {
    if (i % 2 === 0) return '';
    const y = gridTop + i * CELL_TOTAL + CELL_SIZE / 2 + 4;
    return `<text x="${paddingLeft - 8}" y="${y}" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#57606a" text-anchor="end">${name}</text>`;
  }).filter(Boolean);

  // Generate cells using renderer
  let cells = [];
  let vSolidBars = [];
  let hSolidBars = [];
  
  // Pre-calculate landing data for all columns (for growOnJoin)
  const columnLandingData = [];
  weeks.forEach((week, weekIndex) => {
    // Collect active cells in this column with their positions
    const columnCells = [];
    let stackOffset = 0;
    
    week.days.forEach((day, dayIndex) => {
      if (day && day.heightMultiplier > 0) {
        const y = gridTop + dayIndex * CELL_TOTAL;
        const barHeight = renderer.getCellStackHeight(day);
        const targetY = gridBottom - weekStacks[weekIndex].totalHeight + stackOffset;
        
        columnCells.push({
          startY: y,
          height: barHeight,
          targetY
        });
        stackOffset += barHeight;
      }
    });
    
    // Calculate landing times for this column
    columnLandingData[weekIndex] = renderer.calculateVerticalLandingTimes(columnCells);
  });
  
  // Pre-calculate landing data for all rows (for horizontal stacking)
  const rowLandingData = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex++) {
    const rowCells = [];
    let stackOffset = 0;
    
    weeks.forEach((week, weekIndex) => {

      const day = week.days[dayIndex];
      if (day && day.heightMultiplier > 0) {
        const x = gridLeft + weekIndex * CELL_TOTAL;
        const barWidth = renderer.getCellStackWidth(day);
        const targetX = gridLeft + stackOffset;
        
        rowCells.push({
          startX: x,
          width: barWidth,
          targetX,
          weekIndex  // Track weekIndex for stagger calculation
        });
        stackOffset += barWidth;
      }
    });
    
    rowLandingData[dayIndex] = renderer.calculateHorizontalLandingTimes(rowCells);
  }

  weeks.forEach((week, weekIndex) => {
    let vStackOffset = 0;
    let vActiveIndex = 0;
    
    // Track horizontal stack positions for each day
    const hPositions = [];
    for (let di = 0; di < DAYS_IN_WEEK; di++) {
      const day = week.days[di];
      if (day && day.heightMultiplier > 0) {
        let pos = 0;
        for (let wi = 0; wi < weekIndex; wi++) {
          const d = weeks[wi].days[di];
          if (d && d.heightMultiplier > 0) {
            pos += renderer.getCellStackWidth(d);
          }
        }
        hPositions[di] = pos;
      }
    }

    week.days.forEach((day, dayIndex) => {
      const x = gridLeft + weekIndex * CELL_TOTAL;
      const y = gridTop + dayIndex * CELL_TOTAL;
      const color = LEVEL_COLORS[day.level] || LEVEL_COLORS['NONE'];
      
      if (day.heightMultiplier === 0) {
        cells.push(renderer.renderEmptyCell(x, y, color));
      } else {
        const vBarHeight = weekStacks[weekIndex].barHeights[vActiveIndex];
        const vY = gridBottom - weekStacks[weekIndex].totalHeight + vStackOffset;
        
        const hBarWidth = renderer.getCellStackWidth(day);
        const hX = gridLeft + (hPositions[dayIndex] || 0);
        
        // Calculate stagger delay for this cell
        const staggerDelay = renderer.calculateStaggerDelay(weekIndex, dayIndex, numWeeks);
        
        // Look up landing times from pre-calculated data
        const vLandingEntry = columnLandingData[weekIndex]?.find(
          d => Math.abs(d.startY - y) < 1
        );
        // Offset landing time by stagger delay so circle lands when bar expects it
        const vLandingTime = vLandingEntry ? (vLandingEntry.landingTime + staggerDelay) : undefined;
        const vPrevCumulativeHeight = vLandingEntry ? (vLandingEntry.cumulativeHeight - vLandingEntry.height) : 0;
        const vCumulativeHeight = vLandingEntry ? vLandingEntry.cumulativeHeight : 0;
        
        // For horizontal, find this cell's landing time in its row
        const hActiveIndex = weeks.slice(0, weekIndex).filter(w => w.days[dayIndex]?.heightMultiplier > 0).length;
        const hLandingEntry = rowLandingData[dayIndex]?.[hActiveIndex];
        // Offset by stagger delay for horizontal too
        const hLandingTime = hLandingEntry ? (hLandingEntry.landingTime + staggerDelay) : undefined;
        const hPrevCumulativeWidth = hLandingEntry ? (hLandingEntry.cumulativeWidth - hLandingEntry.width) : 0;
        const hCumulativeWidth = hLandingEntry ? hLandingEntry.cumulativeWidth : 0;
        
        // Pass all needed data to renderer
        cells.push(renderer.renderActiveCell({
          x,
          y,
          color,
          vY,
          vH: vBarHeight,
          vTotalHeight: weekStacks[weekIndex].totalHeight,
          vGridBottom: gridBottom,
          hX,
          hW: hBarWidth,
          hTotalWidth: dayStacks[dayIndex].totalWidth,
          hGridLeft: gridLeft,
          staggerDelay,
          level: day.level,
          vStackIndex: vActiveIndex,
          hStackIndex: hActiveIndex,
          weekIndex,
          dayIndex,
          vLandingTime,
          hLandingTime,
          vPrevCumulativeHeight,
          vCumulativeHeight,
          hPrevCumulativeWidth,
          hCumulativeWidth
        }));
        
        vStackOffset += vBarHeight;
        vActiveIndex++;
      }
    });
  });

  // Solid bars for vertical stacks
  weeks.forEach((week, weekIndex) => {
    const h = weekStacks[weekIndex].totalHeight;
    if (h > 0) {
      const x = gridLeft + weekIndex * CELL_TOTAL;
      const y = gridBottom - h;
      let landingData = columnLandingData[weekIndex] || [];
      
      // Offset landing times by column's stagger delay
      if (config.stagger?.enabled) {
        const columnStaggerDelay = renderer.calculateStaggerDelay(weekIndex, 0, numWeeks);
        landingData = landingData.map(d => ({
          ...d,
          landingTime: d.landingTime + columnStaggerDelay
        }));
      }
      
      const bar = renderer.renderVerticalBar(x, y, CELL_SIZE, h, landingData);
      if (bar) vSolidBars.push(bar);
    }
  });
  
  // Solid bars for horizontal stacks
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex++) {
    const w = dayStacks[dayIndex].totalWidth;
    if (w > 0) {
      const x = gridLeft;
      const y = gridTop + dayIndex * CELL_TOTAL;
      let landingData = rowLandingData[dayIndex] || [];
      
      // Offset landing times by each cell's stagger delay
      if (config.stagger?.enabled) {
        landingData = landingData.map(d => ({
          ...d,
          landingTime: d.landingTime + renderer.calculateStaggerDelay(d.weekIndex, dayIndex, numWeeks)
        }));
        // Re-sort by adjusted landing time
        landingData.sort((a, b) => a.landingTime - b.landingTime);
        // Recalculate cumulative widths
        let cumWidth = 0;
        landingData.forEach(d => {
          cumWidth += d.width;
          d.cumulativeWidth = cumWidth;
        });
      }
      
      const bar = renderer.renderHorizontalBar(x, y, w, CELL_SIZE, landingData);
      if (bar) hSolidBars.push(bar);
    }
  }

  // Determine which bars to include based on mode
  const mode = config.animation?.mode || 'both';
  const includeVertical = mode === 'both' || mode === 'vertical';
  const includeHorizontal = mode === 'both' || mode === 'horizontal';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <title>GitHub Contributions Animation</title>
  
  <!-- Month labels -->
  ${monthLabelElements.join('\n  ')}
  
  <!-- Day labels -->
  ${dayLabelElements.join('\n  ')}
  
  ${cells.join('\n  ')}
  
  <!-- Solid vertical bars (by week) -->
  ${includeVertical ? vSolidBars.join('\n  ') : ''}
  
  <!-- Solid horizontal bars (by day) -->
  ${includeHorizontal ? hSolidBars.join('\n  ') : ''}
</svg>`;

  return svg;
}

async function main() {
  const config = loadConfig();
  const dataPath = path.join(__dirname, '..', 'data', 'contributions.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('No contribution data found. Run fetch-contributions.js first.');
    process.exit(1);
  }

  const contributionData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Get renderer for logging
  const renderer = getRenderer(config.transform.style, config);
  const timingInfo = renderer.getTimingInfo();
  
  console.log(`Generating SVG for ${contributionData.username} (${contributionData.totalContributions} contributions)`);
  console.log(`Transform style: ${renderer.getName()}`);
  console.log(`Animation timing: V=${timingInfo.vCycle.duration.toFixed(1)}s, H=${timingInfo.hCycle.duration.toFixed(1)}s, Total=${timingInfo.total.toFixed(1)}s`);
  if (config.stagger.enabled) {
    console.log(`Stagger: ${config.stagger.order}, max delay ${config.stagger.maxDelay}s`);
  }

  // Support custom output path via env var (for reusable action)
  let basePath = process.env.SVG_OUTPUT_PATH || path.join(__dirname, '..', 'data', 'contributions.svg');
  
  // If relative path, resolve from current working directory
  if (!path.isAbsolute(basePath)) {
    basePath = path.resolve(process.cwd(), basePath);
  }
  
  // Ensure output directory exists
  const outputDir = path.dirname(basePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate light version
  const lightSvg = generateSVG(contributionData, config, 'light');
  fs.writeFileSync(basePath, lightSvg);
  console.log(`SVG saved to ${basePath}`);
  
  // Generate dark version with '-dark' suffix
  const ext = path.extname(basePath);
  const darkPath = basePath.replace(ext, `-dark${ext}`);
  const darkSvg = generateSVG(contributionData, config, 'dark');
  fs.writeFileSync(darkPath, darkSvg);
  console.log(`SVG saved to ${darkPath}`);
}

module.exports = { generateSVG, loadConfig };

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
