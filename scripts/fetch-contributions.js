#!/usr/bin/env node

/**
 * Script to fetch GitHub contribution data for the past year
 * Scrapes the public contribution calendar from the GitHub profile page
 * No authentication required!
 */

const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;

// Map data-level attribute to contribution levels
const LEVEL_MAP = {
  '0': 'NONE',
  '1': 'FIRST_QUARTILE',
  '2': 'SECOND_QUARTILE',
  '3': 'THIRD_QUARTILE',
  '4': 'FOURTH_QUARTILE'
};

// Map contribution levels to height multipliers (0.25 to 1.0)
const LEVEL_TO_HEIGHT = {
  'NONE': 0,
  'FIRST_QUARTILE': 0.25,
  'SECOND_QUARTILE': 0.5,
  'THIRD_QUARTILE': 0.75,
  'FOURTH_QUARTILE': 1.0
};

async function fetchContributions() {
  if (!USERNAME) {
    throw new Error('GITHUB_USERNAME environment variable is required');
  }

  console.log(`Fetching contributions for: ${USERNAME}`);

  // Fetch the contribution calendar page
  const url = `https://github.com/users/${USERNAME}/contributions`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'github-chartify'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contributions: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  
  // Parse contribution data from the HTML
  // The calendar uses <td> elements with data-date and data-level attributes
  const dayRegex = /<td[^>]*data-date="([^"]+)"[^>]*data-level="(\d)"[^>]*>/g;
  const contributions = [];
  let match;
  
  while ((match = dayRegex.exec(html)) !== null) {
    const [, date, level] = match;
    contributions.push({
      date,
      level: LEVEL_MAP[level] || 'NONE',
      heightMultiplier: LEVEL_TO_HEIGHT[LEVEL_MAP[level]] || 0
    });
  }

  if (contributions.length === 0) {
    throw new Error('No contribution data found. The GitHub page structure may have changed.');
  }

  // Sort by date
  contributions.sort((a, b) => a.date.localeCompare(b.date));

  // Group into weeks (Sunday = start of week)
  const weeks = [];
  let currentWeek = null;
  
  contributions.forEach(day => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday
    
    if (dayOfWeek === 0 || !currentWeek) {
      currentWeek = { weekIndex: weeks.length, days: [] };
      weeks.push(currentWeek);
    }
    
    // Pad with empty days if needed (for first week)
    while (currentWeek.days.length < dayOfWeek) {
      currentWeek.days.push({
        date: null,
        level: 'NONE',
        heightMultiplier: 0
      });
    }
    
    currentWeek.days.push(day);
  });

  // Calculate total contributions (approximate from levels since we don't have exact counts)
  const totalContributions = contributions.filter(d => d.level !== 'NONE').length;

  const output = {
    username: USERNAME,
    totalContributions,
    fetchedAt: new Date().toISOString(),
    weeks
  };

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write contribution data
  const outputPath = path.join(dataDir, 'contributions.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Contribution data saved to ${outputPath}`);
  console.log(`Found ${contributions.length} days, ${totalContributions} with contributions`);

  return output;
}

// Export for use by other scripts
module.exports = { fetchContributions, LEVEL_TO_HEIGHT };

// Run if called directly
if (require.main === module) {
  fetchContributions().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
