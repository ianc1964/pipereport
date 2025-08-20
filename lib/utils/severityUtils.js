// lib/utils/severityUtils.js

/**
 * Get the color for a traffic light severity group
 * @param {string} severityGroup - 'Low', 'Medium', or 'High'
 * @returns {string} Hex color code
 */
export function getTrafficLightColor(severityGroup) {
  const colors = {
    'Low': '#10b981',    // green-500
    'Medium': '#eab308', // yellow-500  
    'High': '#ef4444'    // red-500
  }
  return colors[severityGroup] || '#6b7280'
}

/**
 * Map a numeric severity (1-5) to a traffic light group
 * @param {number} severity - Severity level from 1 to 5
 * @returns {string|null} 'Low', 'Medium', 'High', or null
 */
export function getTrafficLightGroup(severity) {
  if (severity >= 4) return 'High'
  if (severity === 3) return 'Medium'
  if (severity >= 1) return 'Low'
  return null
}

/**
 * Calculate a letter grade (A/B/C) for a section based on its observations
 * @param {Array} observations - Array of observation objects with severity
 * @returns {string|null} 'A', 'B', 'C', or null if no observations
 */
export function getSectionGrade(observations) {
  // If no observations at all, return null
  if (observations.length === 0) return null
  
  // Separate observations with severity from those without
  const observationsWithSeverity = observations.filter(obs => obs.severity != null)
  const observationsWithoutSeverity = observations.filter(obs => obs.severity == null)
  
  // If there are observations with severity, grade based on the highest severity
  if (observationsWithSeverity.length > 0) {
    const maxSeverity = Math.max(...observationsWithSeverity.map(obs => obs.severity))
    if (maxSeverity >= 4) return 'C'  // Critical issues
    if (maxSeverity === 3) return 'B' // Medium issues
    return 'A'  // Low severity issues (1-2)
  }
  
  // If no observations have severity but there are observations without severity,
  // these are non-issues (informational only), so grade as 'A'
  if (observationsWithoutSeverity.length > 0) {
    return 'A'
  }
  
  // Should not reach here, but return null as fallback
  return null
}

/**
 * Count observations by traffic light group
 * @param {Array} sectionObs - Array of observation objects
 * @returns {Object} Object with counts for each group {Low: n, Medium: n, High: n}
 */
export function getTrafficLightCounts(sectionObs) {
  const counts = { Low: 0, Medium: 0, High: 0 }
  sectionObs.forEach(obs => {
    const group = getTrafficLightGroup(obs.severity)
    if (group) counts[group]++
  })
  return counts
}

/**
 * Get the appropriate icon color for a severity level (1-5 scale)
 * @param {number} severity - Severity level from 1 to 5
 * @returns {string} Hex color code
 */
export function getSeverityColor(severity) {
  const colors = {
    5: '#ef4444', // red-500
    4: '#f97316', // orange-500
    3: '#eab308', // yellow-500
    2: '#3b82f6', // blue-500
    1: '#10b981'  // green-500
  }
  return colors[severity] || '#6b7280'
}

/**
 * Get a human-readable label for a severity level
 * @param {number} severity - Severity level from 1 to 5
 * @returns {string} Label text
 */
export function getSeverityLabel(severity) {
  const labels = {
    5: 'Critical',
    4: 'High',
    3: 'Medium',
    2: 'Low',
    1: 'Minor'
  }
  return labels[severity] || ''
}

/**
 * Calculate traffic light distribution for a set of observations
 * @param {Array} observations - Array of observation objects
 * @returns {Object} Object with counts and percentages for each group
 */
export function getTrafficLightDistribution(observations) {
  const counts = { Low: 0, Medium: 0, High: 0 }
  
  observations.forEach(obs => {
    const group = getTrafficLightGroup(obs.severity)
    if (group) counts[group]++
  })
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  
  const distribution = {}
  Object.keys(counts).forEach(key => {
    distribution[key] = {
      count: counts[key],
      percentage: total > 0 ? (counts[key] / total) * 100 : 0
    }
  })
  
  return {
    counts,
    distribution,
    total
  }
}

/**
 * Get category label for recommendations
 * @param {string} category - Category key
 * @returns {string} Human-readable label
 */
export function getCategoryLabel(category) {
  const labels = {
    immediate: 'Immediate Action',
    short_term: 'Short Term',
    long_term: 'Long Term',
    preventive: 'Preventive',
    monitoring: 'Monitoring'
  }
  return labels[category] || category
}