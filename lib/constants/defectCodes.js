// lib/constants/defectCodes.js

// Defect code explanations based on WRc MSCC5 standards
export const defectExplanations = {
  // Structural Defects
  'B': 'Broken - Pieces of pipe are visibly displaced and moved from original position. Often associated with deformity.',
  'JX': 'Defective Junction - the Junction (purpose made/built in) is damaged or obstructed in any way.',
  'CX': 'Defective Connection - the Connection (added later) is damaged, poorly constructed or obstructed in any way.',
  'CXI': 'Defective Intruding Connection - the Connection pipe intrudes into the drain.',
  'C': 'Crack/s - Longitudinal, Circumferential, or Multiple cracking where pipe is not visibly open.',
  'F': 'Fracture/s - Longitudinal, Circumferential, or Multiple fracture/s where pipe is not visibly open.',
  'H': 'Hole - a visible hole in the fabric of the pipe.',
  'D': 'Deformed - original cross sectional area/circular form of the pipe has been reduced or altered.',
  'SR': 'Sealing Ring Intruding - the joint seal/material between two pipes can be seen intruding into the pipe.',
  'S': 'Surface Damage - the pipe wall surface has been damaged by erosion, wear or mechanical reduction.',
  'XP': 'Collapsed Pipe - a complete loss of structural integrity reducing the cross-section by over 50%.',
  'LX': 'Defective Lining - a wrinkled, blistered, failed, bulged, blistered etc., lining sleeve.',
  
  // Joint Defects
  'JD': 'Joint Displaced, Medium or Large - Movement where the adjacent pipe has skewed or is off centre. The pipe wall thickness can be seen.',
  'OJ': 'Open Joint, Medium or Large - Longitudinal (where pipes are pulled apart) movement and the pipe wall thickness can be seen.',
  
  // Obstructions
  'OB': 'Obstruction - An obstacle is blocking or partially blocking the pipe and is likely to affect the flow.',
  'R': 'Roots - Tree roots have penetrated the pipe. Often defined as Fine, Tap or Mass roots.',
    
  // Deposits
  'DEG': 'Attached Deposits, Grease - Grease accumulation on pipe walls causing loss of cross-sectional area.',
  'DER': 'Settled Deposits, Coarse - Gravel, chippings or coarser materials affecting flow and causing turbulence.',
  'DES': 'Settled Deposits, Fine - Sand, silt or finer materials affecting flow and causing turbulence.',
  'DEE': 'Attached Deposits, Encrustation - calcium or similar deposits often caused by seeping joints, cracks and fractures.',

  // Deviations
  'LD': 'Line of drain/sewer deviates down.',
  'LL': 'Line of drain/sewer deviates left.',
  'LR': 'Line of drain/sewer deviates right.',
  'LU': 'Line of drain/sewer deviates up.',

  // Construction
  'CN': 'Connection - a pipe that has been added to the after initial installation.',
  'JN': 'Junction - a preformed/purpose made junction built in on initial construction.',
  'SC': 'Shape Change - the diameter or dimensions of the pipe have changed.',
    
  // Other Conditions
  'WL': 'Water Level - Indicates the water level observed in the pipe.',
  'I': 'Infiltration - Water entering pipe through defects.',
  'SA': 'Survey Abandoned - the survey could not be continued any further for any reason and was abandonded.',
  'REM': 'Remark - Additional information where a defect or observation is not included in the standardised system.',
  'MC': 'Material Change - the pipe material changes to a different material at this point.', 
  'V': 'Vermin - Rats are observed in the pipe.',
  'START': 'The beginning point of the survey. Will normally include the start node type.',
  'FINISH': 'The finish point of the survey. Will normally include the finish node type.',
  'CU': 'Loss of Vision - the camera view is obstructed by high water levels or other materials.',
  
  // Add more codes as needed...
}

// Helper function to get defect explanation
export function getDefectExplanation(code) {
  return defectExplanations[code] || null
}

// Helper function to check if a code exists
export function isValidDefectCode(code) {
  return code in defectExplanations
}

// Get all defect codes grouped by category
export function getDefectCodesByCategory() {
  return {
    structural: ['B', 'JX', 'CX', 'CXI', 'C', 'F', 'H', 'D', 'SR', 'S', 'XP', 'LX'],
    joints: ['JD', 'OJ'],
    obstructions: ['OB', 'R'],
    deposits: ['DEG', 'DER', 'DES', 'DEE'],
    deviations: ['LD', 'LL', 'LR', 'LU'],
    construction: ['CN', 'JN', 'SC'],
    other: ['WL', 'I', 'SA', 'REM', 'MC', 'V', 'START', 'FINISH', 'CU']
  }
}