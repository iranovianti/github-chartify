/**
 * Renderer Registry
 * 
 * Exports all available cell renderers and provides a factory function
 * to get the appropriate renderer based on configuration.
 */

const { RectCellRenderer } = require('./rect-renderer');
const { CircleCellRenderer } = require('./circle-renderer');

const RENDERERS = {
  'rectangle': RectCellRenderer,
  'rect': RectCellRenderer,
  'shrink': RectCellRenderer,  // legacy alias
  'circles': CircleCellRenderer,
  'circle': CircleCellRenderer
};

/**
 * Get a renderer instance based on transform style
 * @param {string} style - 'rectangle' or 'circles'
 * @param {Object} config - Full configuration object
 * @param {string} theme - 'light' or 'dark'
 * @returns {BaseCellRenderer} Renderer instance
 */
function getRenderer(style, config, theme = 'light') {
  const RendererClass = RENDERERS[style] || RENDERERS['rectangle'];
  return new RendererClass(config, theme);
}

/**
 * List available renderer styles
 */
function getAvailableStyles() {
  return ['rectangle', 'circles'];
}

module.exports = {
  getRenderer,
  getAvailableStyles,
  RectCellRenderer,
  CircleCellRenderer
};
