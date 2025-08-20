// components/reports/DefectGuide.js
'use client'

// Default defect explanations - can be overridden by importing from external file if it exists
const defaultDefectExplanations = {
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
  'JD': 'Joint Displaced, Medium or Large - Movement where the adjacent pipe has skewed or is off centre. The pipe wall thickness can be seen.',
  'OJ': 'Open Joint, Medium or Large - Longitudinal (where pipes are pulled apart) movement and the pipe wall thickness can be seen.',
  
  // Service Defects
  'OB': 'Obstruction - An obstacle is blocking or partially blocking the pipe and is likely to affect the flow.',
  'R': 'Roots - Tree roots have penetrated the pipe. Often defined as Fine, Tap or Mass roots.',
  'DEG': 'Attached Deposits, Grease - Grease accumulation on pipe walls causing loss of cross-sectional area.',
  'DER': 'Settled Deposits, Coarse - Gravel, chippings or coarser materials affecting flow and causing turbulence.',
  'DES': 'Settled Deposits, Fine - Sand, silt or finer materials affecting flow and causing turbulence.',
  'DEE': 'Attached Deposits, Encrustation - calcium or similar deposits often caused by seeping joints, cracks and fractures.',
  
  // Construction
  'LD': 'Line of drain/sewer deviates down.',
  'LL': 'Line of drain/sewer deviates left.',
  'LR': 'Line of drain/sewer deviates right.',
  'LU': 'Line of drain/sewer deviates up.',  
  'CN': 'Connection - a pipe that has been added to the after initial installation.',
  'JN': 'Junction - a preformed/purpose made junction built in on initial construction.',
  'SC': 'Shape Change - the diameter or dimensions of the pipe have changed.',
  
  // Miscellaneous
  'WL': 'Water Level - Indicates the water level observed in the pipe.',
  'I': 'Infiltration - Water entering pipe through defects.',
  'SA': 'Survey Abandoned - the survey could not be continued any further for any reason and was abandonded.',
  'REM': 'Remark - Additional information where a defect or observation is not included in the standardised system.',
  'MC': 'Material Change - the pipe material changes to a different material at this point.', 
  'V': 'Vermin - Rats are observed in the pipe.',
  'START': 'The beginning point of the survey. Will normally include the start node type.',
  'FINISH': 'The finish point of the survey. Will normally include the finish node type.',
  'CU': 'Loss of Vision - the camera view is obstructed by high water levels or other materials.',
}

export default function DefectGuide() {
  // Try to use imported defect explanations, fall back to defaults
  const defectExplanations = defaultDefectExplanations

  // Group defect codes by category for better organization
  const categorizedDefects = {
    'Structural Defects': ['B', 'JX', 'CX', 'CXI', 'C', 'F', 'H', 'D','SR', 'S', 'XP', 'LX', 'JD', 'OJ'],
    'Service Defects': ['OB', 'R', 'DEG', 'DER', 'DES', 'DEE'],
    'Construction': ['LD', 'LL', 'LR', 'LU', 'CN', 'JN', 'SC'],
    'Miscellaneous': ['WL', 'SA', 'I', 'REM', 'MC', 'V', 'CU', 'START', 'FINISH']
  }

  return (
    <div className="defect-guide-section print:block hidden page-break-before" id="defect-guide">
      <h2 className="text-2xl font-bold mb-6">Guide to Observation and Defect Codes</h2>
      
      <p className="mb-6 text-sm">
        The following codes are used throughout this report to identify specific types of observations 
        and defects found during the inspection. Understanding these codes will help in interpreting 
        the findings and prioritizing remedial actions.
      </p>

      {Object.entries(categorizedDefects).map(([category, codes]) => (
        <div key={category} className="mb-8 avoid-break">
          <h3 className="text-lg font-semibold mb-4 text-primary">{category}</h3>
          
          <div className="defect-reference">
            {codes.map(code => {
              const explanation = defectExplanations[code]
              if (!explanation) return null
              
              return (
                <div key={code} className="defect-item mb-3">
                  <div className="flex items-start">
                    <span className="font-bold text-sm bg-gray-100 px-2 py-1 rounded mr-3 inline-block min-w-[3rem] text-center">
                      {code}
                    </span>
                    <span className="text-sm">{explanation}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded">
        <h4 className="font-semibold mb-2">Severity Ratings</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-red-500 rounded-full mr-3"></span>
            <span><strong>High (4-5):</strong> Requires immediate attention. Structural integrity or functionality at risk.</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-yellow-500 rounded-full mr-3"></span>
            <span><strong>Medium (3):</strong> Requires attention within planned maintenance cycle.</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 bg-green-500 rounded-full mr-3"></span>
            <span><strong>Low (1-2):</strong> Minor defects requiring monitoring or routine maintenance.</span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-600">
        <p>
          Note: These codes follow industry standards as defined in EN 13508-2 and WRc's Manual of 
          Sewer Condition Classification (MSCC). The severity ratings are based on the potential impact 
          on structural integrity, service reliability, and public safety.
        </p>
      </div>
    </div>
  )
}