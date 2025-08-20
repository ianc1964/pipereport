// Action types for undo/redo system
export const ACTION_TYPES = {
  CREATE_NODE: 'CREATE_NODE',
  DELETE_NODE: 'DELETE_NODE',
  UPDATE_NODE: 'UPDATE_NODE',
  MOVE_NODE: 'MOVE_NODE',
  CREATE_LINE: 'CREATE_LINE',
  DELETE_LINE: 'DELETE_LINE',
  UPDATE_WAYPOINTS: 'UPDATE_WAYPOINTS',
  UPLOAD_BACKGROUND: 'UPLOAD_BACKGROUND',
  CREATE_DRAWING: 'CREATE_DRAWING',
  DELETE_DRAWING: 'DELETE_DRAWING',
  UPDATE_DRAWING: 'UPDATE_DRAWING'
}

// Maximum history size to prevent memory issues
export const MAX_HISTORY_SIZE = 50

// Map modes
export const MAP_MODES = {
  VIEW: 'view',
  ADD_NODE: 'add_node',
  DRAW_LINE: 'draw_line',
  DRAWING: 'drawing'
}

// Default map settings (re-exported from mapHelpers for convenience)
export const DEFAULT_CENTER = [51.505, -0.09] // Default to London
export const DEFAULT_ZOOM = 15
export const DEFAULT_BOUNDS = [[51.49, -0.12], [51.52, -0.06]]

// Leaflet icon fix configuration
export const LEAFLET_ICON_CONFIG = {
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
}