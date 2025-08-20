// lib/services/llm-report-service.js
// Enhanced LLM service with integrated repair knowledge base
// 
// 🚨 CRITICAL FIX: This service now filters out informational observations 
// (junctions, line deviations, connections, etc.) before AI analysis.
// The AI will only see actual issues with severity scores.

'use server'

import { createClient } from '@supabase/supabase-js'

// CRITICAL: Import filtering function to ensure AI only sees actual issues
import { filterReportForAIAnalysis } from '@/lib/utils/observation-filter'

// Initialize Supabase for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Simple in-memory queue for demo (in production, use Redis or database)
const requestQueue = []
let isProcessing = false
const MAX_CONCURRENT = 4 // Process 4 requests at a time (under 6000 token limit)

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'

// STRUCTURED REPAIR KNOWLEDGE BASE
const REPAIR_KNOWLEDGE_BASE = {
  // High Severity Defects - Likely require excavation
  high_severity: {
    'XP': {
      name: 'Collapsed',
      severity: 'critical',
      primary_repair: 'excavation',
      description: 'Complete pipe collapse requiring immediate excavation and replacement',
      methods: ['Excavation and replacement with new pipe', 'Full structural assessment required'],
      timeframe: '24-48 hours',
      cost_factor: 'high'
    },
    'B': {
      name: 'Broken',
      severity: 'critical',
      primary_repair: 'excavation',
      alternative: 'CIPR if <20% cross-sectional loss and deep',
      description: 'Structural break in pipe wall',
      methods: [
        'Excavation and repair (recommended)',
        'CIPR if depth >2m and damage <20% cross-sectional area',
        'Full replacement if multiple breaks'
      ],
      timeframe: '48-72 hours',
      cost_factor: 'high'
    },
    'JDL': {
      name: 'Joint Displaced Large',
      severity: 'critical',
      primary_repair: 'excavation',
      alternative: 'CIPR if deep or difficult access',
      description: 'Significant joint displacement affecting structural integrity',
      methods: [
        'Excavation and repair (recommended)',
        'CIPR if access is difficult or pipe is deep',
        'Consider full section replacement'
      ],
      timeframe: '48-72 hours',
      cost_factor: 'high'
    },
    'OJL': {
      name: 'Open Joint Large',
      severity: 'critical',
      primary_repair: 'excavation',
      alternative: 'CIPR if deep or difficult access',
      description: 'Large joint opening allowing infiltration/exfiltration',
      methods: [
        'Excavation and repair (recommended)',
        'CIPR if depth >2m or difficult access',
        'Ensure proper bedding and backfill'
      ],
      timeframe: '48-72 hours',
      cost_factor: 'high'
    },
    'CXI': {
      name: 'Defective Intruding Connection',
      severity: 'critical',
      primary_repair: 'excavation',
      description: 'Connection protruding into main pipe affecting flow',
      methods: [
        'Excavation and proper connection reconstruction',
        'Remove protruding material',
        'Install proper junction or connection'
      ],
      timeframe: '48-72 hours',
      cost_factor: 'medium-high'
    }
  },

  // Medium Severity - May use no-dig solutions
  medium_severity: {
    'JX': {
      name: 'Defective Junction',
      severity: 'high',
      primary_repair: 'excavation',
      alternative: 'specialist CIPR depending on severity',
      description: 'Junction requiring repair',
      methods: [
        'Excavation and repair (recommended)',
        'Specialist CIPR methods available depending on severity',
        'Assess structural integrity before repair choice'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'medium-high'
    },
    'CX': {
      name: 'Defective Connection',
      severity: 'high',
      primary_repair: 'excavation',
      alternative: 'specialist CIPR depending on severity',
      description: 'Connection requiring repair',
      methods: [
        'Excavation and repair (recommended)',
        'Specialist CIPR methods available',
        'Ensure proper connection standards'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'medium'
    },
    'D': {
      name: 'Deformed',
      severity: 'medium-high',
      primary_repair: 'CIPR/CIPP',
      conditions: 'If ≤10% deformity (rigid pipes) or ≤20% (flexible pipes)',
      description: 'Pipe deformation affecting flow',
      methods: [
        'CIPR or CIPP if deformity ≤10% (rigid pipes)',
        'CIPR or CIPP if deformity ≤20% (flexible pipes)',
        'Excavation if deformity exceeds limits'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'medium'
    }
  },

  // Lower Severity - Patch repairs suitable
  lower_severity: {
    'R': {
      name: 'Roots',
      severity: 'medium',
      primary_repair: 'cutting + CIPR',
      description: 'Root intrusion requiring removal and sealing',
      methods: [
        'Cut out roots (unless very fine)',
        'Insert CIPR sleeve to prevent regrowth',
        'Seal area to make watertight',
        'Consider chemical root treatment'
      ],
      timeframe: '1 week',
      cost_factor: 'low-medium'
    },
    'JDM': {
      name: 'Joint Displaced Medium',
      severity: 'medium',
      primary_repair: 'CIPR',
      description: 'Medium joint displacement',
      methods: [
        'CIPR patch lining sleeve',
        'Make watertight and smooth',
        'Reduce flow restriction potential'
      ],
      timeframe: '1 week',
      cost_factor: 'low-medium'
    },
    'OJM': {
      name: 'Open Joint Medium',
      severity: 'medium',
      primary_repair: 'CIPR',
      description: 'Medium open joint',
      methods: [
        'CIPR patch lining sleeve',
        'Seal to prevent infiltration',
        'Smooth internal surface'
      ],
      timeframe: '1 week',
      cost_factor: 'low-medium'
    },
    'CC': {
      name: 'Circumferential Crack',
      severity: 'low-medium',
      primary_repair: 'CIPR',
      description: 'Crack requiring sealing',
      methods: [
        'CIPR patch repair',
        'Seal crack to prevent water ingress',
        'Monitor for expansion'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'low'
    },
    'CL': {
      name: 'Longitudinal Crack',
      severity: 'low-medium',
      primary_repair: 'CIPR',
      description: 'Longitudinal crack requiring sealing',
      methods: [
        'CIPR patch repair',
        'Seal to prevent deterioration',
        'Assess structural impact'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'low'
    }
  },

  // Cleaning Required
  cleaning_required: {
    'DES': {
      name: 'Deposits Grease',
      severity: 'maintenance',
      primary_repair: 'cleaning',
      description: 'Attached grease deposits',
      methods: [
        'High pressure water jetting',
        'Remove attached deposits',
        'Restore operational capacity'
      ],
      timeframe: 'Same day',
      cost_factor: 'low'
    },
    'DEE': {
      name: 'Deposits Encrustation',
      severity: 'maintenance',
      primary_repair: 'descaling',
      description: 'Scale buildup requiring removal',
      methods: [
        'Electro-mechanical descaling',
        'Milling equipment for scale removal',
        'High pressure jetting as alternative'
      ],
      timeframe: '1-2 days',
      cost_factor: 'low-medium'
    },
    'DER': {
      name: 'Deposits Coarse',
      severity: 'maintenance',
      primary_repair: 'cleaning',
      description: 'Settled coarse deposits',
      methods: [
        'High pressure water jetting',
        'Remove settled deposits',
        'Clear operational restrictions'
      ],
      timeframe: 'Same day',
      cost_factor: 'low'
    },
    'OB': {
      name: 'Obstruction',
      severity: 'varies',
      primary_repair: 'depends on type',
      description: 'Obstruction affecting capacity',
      methods: [
        'High pressure jetting (if soft/loose)',
        'Excavation if large and solid',
        'Assess cross-sectional area loss',
        'Consider obstruction type and size'
      ],
      timeframe: 'Same day to 1 week',
      cost_factor: 'low to high'
    }
  },

  // Special Materials
  special_materials: {
    'PF': {
      name: 'Pitch Fibre',
      severity: 'material-specific',
      primary_repair: 're-rounding + CIPP',
      description: 'Pitch fibre commonly suffers deformity',
      methods: [
        'Re-round using specialist tool',
        'Install CIPP after re-rounding',
        'Alternative: excavate and replace',
        'Consider pipe bursting option'
      ],
      timeframe: '1-2 weeks',
      cost_factor: 'medium'
    }
  },

  // Repair Method Definitions
  repair_methods: {
    'CIPP': {
      name: 'Cured In Place Pipe',
      description: 'Full structural lining - no dig method',
      suitable_for: 'Multiple defects, structural renewal',
      considerations: [
        'Note junctions and connections for reopening',
        'Requires drain cleaning prior to installation',
        'Creates noxious fumes - ensure ventilation',
        'Drain out of use during installation (hours)',
        'Accurate measurement essential'
      ],
      lifespan: '50+ years'
    },
    'CIPR': {
      name: 'Cured In Place Repair',
      description: 'Patch lining - localized no dig repair',
      suitable_for: 'Individual defects, point repairs',
      considerations: [
        'Use CIPP if multiple close defects',
        'Requires drain cleaning',
        'Ventilation required',
        'Short downtime',
        'Precise positioning needed'
      ],
      lifespan: '25-50 years'
    },
    'excavation': {
      name: 'Excavation and Repair',
      description: 'Traditional dig and replace method',
      suitable_for: 'Severe structural damage, shallow depths',
      considerations: [
        'Significant surface disruption',
        'Trace drain accurately before excavation',
        'Locate other utilities (CAT scan)',
        'Consider spoil storage and removal',
        'Surface reinstatement required',
        'Trench safety measures essential',
        'Keep 1.5x trench depth from structures'
      ],
      lifespan: '50+ years'
    }
  },

  // Grade Definitions
  grade_definitions: {
    'A': 'Serviceable - no recommendations required (SRM grades 1-2)',
    'B': 'Issue requiring possible remedial works (SRM grade 3)',
    'C': 'Defect requiring remedial works - not serviceable (SRM grades 4-5)'
  }
}

/**
 * Generate executive summary from inspection data
 * CRITICAL: Only analyzes actual issues, not informational observations
 */
export async function generateExecutiveSummary(reportData, userId) {
  try {
    console.log('🤖 Starting executive summary generation...')
    
    // Validate input
    if (!reportData || !userId) {
      throw new Error('Missing required data or user ID')
    }

    // CRITICAL: Filter out informational observations before analysis
    const filteredReportData = filterReportForAIAnalysis(reportData)
    console.log(`📊 Filtered observations: ${filteredReportData.observations_snapshot.length} issues (from ${reportData.observations_snapshot?.length || 0} total observations)`)

    // Analyze only the actual issues
    const analysis = analyzeInspectionData(filteredReportData)
    
    // Create prompt for LLM using filtered data
    const prompt = createExecutiveSummaryPrompt(analysis, filteredReportData)
    
    // Add to queue
    const queueItem = {
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'executive_summary',
      prompt,
      userId,
      reportId: reportData.id,
      status: 'queued',
      createdAt: new Date(),
      estimatedTokens: estimateTokens(prompt)
    }
    
    requestQueue.push(queueItem)
    
    // Start processing if not already running
    if (!isProcessing) {
      processQueue()
    }
    
    return {
      success: true,
      queueId: queueItem.id,
      position: requestQueue.length,
      estimatedWait: calculateEstimatedWait()
    }
    
  } catch (error) {
    console.error('❌ Executive summary generation failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Generate repair recommendations with integrated knowledge base
 * CRITICAL: Only analyzes actual issues, not informational observations
 */
export async function generateRepairRecommendations(reportData, userId) {
  try {
    console.log('🔧 Starting repair recommendations generation with knowledge base...')
    
    // CRITICAL: Filter out informational observations before analysis
    const filteredReportData = filterReportForAIAnalysis(reportData)
    console.log(`🔍 Filtered observations: ${filteredReportData.observations_snapshot.length} issues (from ${reportData.observations_snapshot?.length || 0} total observations)`)
    
    const analysis = analyzeInspectionData(filteredReportData)
    
    // Extract relevant repair knowledge based on detected defects
    const relevantKnowledge = extractRelevantRepairKnowledge(analysis)
    
    // Create enhanced prompt with knowledge base using filtered data
    const prompt = createEnhancedRepairRecommendationsPrompt(analysis, filteredReportData, relevantKnowledge)
    
    const queueItem = {
      id: `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'repair_recommendations',
      prompt,
      userId,
      reportId: reportData.id,
      status: 'queued',
      createdAt: new Date(),
      estimatedTokens: estimateTokens(prompt)
    }
    
    requestQueue.push(queueItem)
    
    if (!isProcessing) {
      processQueue()
    }
    
    return {
      success: true,
      queueId: queueItem.id,
      position: requestQueue.length,
      estimatedWait: calculateEstimatedWait()
    }
    
  } catch (error) {
    console.error('❌ Repair recommendations generation failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extract relevant repair knowledge based on detected defects
 */
function extractRelevantRepairKnowledge(analysis) {
  const relevantKnowledge = {
    high_severity: {},
    medium_severity: {},
    lower_severity: {},
    cleaning_required: {},
    special_materials: {},
    repair_methods: {}
  }
  
  // Get all unique defect codes from observations
  const detectedCodes = new Set()
  analysis.criticalIssues.forEach(obs => {
    if (obs.code) detectedCodes.add(obs.code)
  })
  
  // Add codes from common issues
  analysis.commonIssues.forEach(item => {
    const code = item.issue.split(':')[0]?.trim()
    if (code) detectedCodes.add(code)
  })
  
  console.log('🔍 Detected defect codes:', Array.from(detectedCodes))
  
  // Only check defect categories, not repair_methods or grade_definitions
  const defectCategories = [
    'high_severity',
    'medium_severity', 
    'lower_severity',
    'cleaning_required',
    'special_materials'
  ]

  // Extract relevant knowledge for each detected code
  detectedCodes.forEach(code => {
    // Check each defect severity category only
    defectCategories.forEach(category => {
      const categoryItems = REPAIR_KNOWLEDGE_BASE[category]
      if (categoryItems && categoryItems[code]) {
        relevantKnowledge[category][code] = categoryItems[code]
        // ... rest of the method extraction logic
      }
    })
  })
  
  // Always include repair method definitions
  if (Object.keys(relevantKnowledge.repair_methods).length === 0) {
    relevantKnowledge.repair_methods = REPAIR_KNOWLEDGE_BASE.repair_methods
  }
  
  return relevantKnowledge
}

/**
 * Create enhanced repair recommendations prompt with editorial narrative style
 * Only includes sections with severity-rated defects and uses proper field detection
 */
function createEnhancedRepairRecommendationsPrompt(analysis, reportData, knowledge) {
  try {
    // Build knowledge reference (simplified for narrative context)
    const knowledgeText = []
    
    // Add defect knowledge from all categories
    const categories = ['high_severity', 'medium_severity', 'lower_severity', 'cleaning_required', 'special_materials']
    
    categories.forEach(category => {
      const items = knowledge[category]
      if (items && typeof items === 'object') {
        Object.keys(items).forEach(code => {
          const info = items[code]
          if (info) {
            knowledgeText.push(`${code} (${info.name || code}): ${info.primary_repair || 'repair'}`)
            if (info.description) knowledgeText.push(`Description: ${info.description}`)
            if (info.methods && Array.isArray(info.methods)) {
              knowledgeText.push(`Methods: ${info.methods.join('; ')}`)
            }
            if (info.timeframe) knowledgeText.push(`Timeframe: ${info.timeframe}`)
            knowledgeText.push('')
          }
        })
      }
    })
    
    // Build section details - ONLY include sections with SEVERITY-RATED defects
    const sections = reportData.sections_snapshot || []
    const observations = reportData.observations_snapshot || []
    
    // Group observations by section, but ONLY include observations with severity
    const sectionObservations = {}
    observations.forEach(obs => {
      // FIXED: Only include observations that have a severity rating (not null/undefined/0)
      if (obs.section_id && obs.severity && obs.severity > 0) {
        if (!sectionObservations[obs.section_id]) {
          sectionObservations[obs.section_id] = []
        }
        sectionObservations[obs.section_id].push(obs)
      }
    })
    
    // Build section details text - ONLY for sections with severity-rated defects
    const sectionDetails = []
    
    Object.keys(sectionObservations).forEach(sectionId => {
      const sectionObs = sectionObservations[sectionId]
      const section = sections.find(s => s.id === sectionId)
      
      // ONLY include sections that have observations with severity ratings
      if (section && sectionObs.length > 0) {
        // Sort by severity (highest first)
        sectionObs.sort((a, b) => (b.severity || 0) - (a.severity || 0))
        
        // FIXED: Enhanced detection of start/finish reference fields
        const sectionName = section.name || section.header || `Section ${sectionId.slice(-3)}`
        const startRef = getStartReference(section)
        const finishRef = getFinishReference(section)
        
        sectionDetails.push(`${sectionName}: ${startRef} to ${finishRef}`)
        
        // Add subtitle with technical details
        const diameter = section.diameter || 'Unknown'
        const material = section.material || 'Unknown'
        const use = section.use || 'Unknown'
        const direction = section.direction || 'Not specified'
        
        sectionDetails.push(`${diameter} | ${material} | ${use} | Direction: ${direction}`)
        sectionDetails.push('Defects found (by severity):')
        
        sectionObs.forEach(obs => {
          sectionDetails.push(`- ${obs.code || 'Unknown'}: ${obs.description || obs.code || 'Defect'} (Severity ${obs.severity || 0}) at ${obs.distance || 'Unknown'}m`)
        })
        sectionDetails.push('')
      }
    })

    // If no sections have defects with severity ratings, return a simple response
    if (sectionDetails.length === 0) {
      return `You are a professional drainage engineer. Based on the CCTV inspection of ${analysis.projectName}, no defects requiring remedial works were identified across the ${analysis.totalSections} sections inspected. 

Write a brief professional summary stating that the drainage system is in good condition with no immediate repair recommendations required. Keep it professional and positive, mentioning the inspection was comprehensive and the system is performing well.`
    }

    return `You are a professional drainage engineer writing comprehensive repair recommendations for ${analysis.projectName}.

${knowledgeText.join('\n')}

REPAIR METHODS AVAILABLE:
- CIPP (Cured In Place Pipe): Full structural lining for multiple defects
- CIPR (Cured In Place Repair): Patch repair for individual defects  
- Excavation: Dig and replace for severe damage
- High Pressure Jetting: Cleaning for deposits and blockages
- Electro-mechanical descaling: For scale and encrustation removal

SECTIONS WITH DEFECTS REQUIRING ATTENTION:
${sectionDetails.join('\n')}

PROJECT SUMMARY:
- Project: ${analysis.projectName}
- Total Sections Inspected: ${analysis.totalSections}
- Sections with Defects: ${Object.keys(sectionObservations).length}
- Critical Issues: ${analysis.severityCount.critical + analysis.severityCount.high}
- Medium Issues: ${analysis.severityCount.medium}
- Low Issues: ${analysis.severityCount.low}

Write a comprehensive repair recommendations summary in an editorial, narrative style. For each section that has defects, write flowing paragraphs that:

1. Start with the section name and reference points (e.g., "Main Sewer Line: MH101 to MH102")
2. Include technical details as a subtitle (diameter, material, use, direction)
3. Describe the defects found in order of severity
4. Explain the recommended repair approach for each defect with rationale
5. Include timeframes and urgency levels
6. Flow naturally between defects and recommendations

Use professional engineering language but keep it accessible for clients. Write in complete paragraphs, not bullet points or lists. Each section should read like a professional engineering assessment.

Example format:
**Main Sewer Line: MH101 to MH102**
*150mm Vitrified Clay | Foul Sewer | Direction: Downstream*

This section revealed several defects requiring remedial attention. The most serious finding was a significant structural break at 3.9m (Code B: Broken, Severity 5) which compromises the pipeline integrity and requires immediate intervention. Our professional recommendation is to undertake excavation and repair within 48-72 hours, as the extent of structural damage exceeds the threshold for no-dig repair solutions.

Additionally, we identified settled coarse deposits at 7.9m (Code DER: Deposits Coarse, Severity 2) which, while not immediately critical, would benefit from high-pressure water jetting to restore full operational capacity and prevent further accumulation...

Focus on providing clear, professional guidance that explains both what needs to be done and why. Use the expert knowledge base to recommend specific repair methods for each defect code found.`

  } catch (error) {
    console.error('Error building prompt:', error)
    // Fallback to simple prompt
    return `You are a professional drainage engineer writing repair recommendations for ${analysis.projectName}.

Project Summary:
- Total Sections: ${analysis.totalSections}
- Critical Issues: ${analysis.severityCount.critical + analysis.severityCount.high}
- Medium Issues: ${analysis.severityCount.medium}
- Low Issues: ${analysis.severityCount.low}

Critical Defects Found:
${analysis.criticalIssues.slice(0, 5).map(obs => `- ${obs.code}: ${obs.description || obs.code} (Severity ${obs.severity})`).join('\n')}

Write professional repair recommendations in narrative style, organized by section with specific repair methods and timeframes.`
  }
}

/**
 * FIXED: Enhanced function to detect start reference from various possible field names
 */
function getStartReference(section) {
  // Try multiple possible field names for start reference
  const possibleStartFields = [
    'start_node',
    'start_point', 
    'start_ref',
    'startNode',
    'startPoint',
    'startRef',
    'from_node',
    'from_point',
    'from_ref'
  ]
  
  for (const field of possibleStartFields) {
    if (section[field] && section[field] !== 'Unknown' && section[field] !== '') {
      return section[field]
    }
  }
  
  // If no field found, return descriptive fallback
  return 'Start'
}

/**
 * FIXED: Enhanced function to detect finish reference from various possible field names
 */
function getFinishReference(section) {
  // Try multiple possible field names for finish reference
  const possibleFinishFields = [
    'finish_node',
    'finish_point',
    'finish_ref', 
    'finishNode',
    'finishPoint',
    'finishRef',
    'to_node',
    'to_point',
    'to_ref',
    'end_node',
    'end_point',
    'end_ref'
  ]
  
  for (const field of possibleFinishFields) {
    if (section[field] && section[field] !== 'Unknown' && section[field] !== '') {
      return section[field]
    }
  }
  
  // If no field found, return descriptive fallback
  return 'Finish'
}

export async function checkGenerationStatus(queueId) {
  const item = requestQueue.find(item => item.id === queueId)
  
  if (!item) {
    return {
      success: false,
      error: 'Request not found'
    }
  }
  
  // Calculate current position
  const queuedItems = requestQueue.filter(item => item.status === 'queued')
  const currentPosition = queuedItems.findIndex(item => item.id === queueId) + 1
  
  return {
    success: true,
    status: item.status,
    position: currentPosition,
    estimatedWait: calculateEstimatedWait(currentPosition),
    result: item.result,
    error: item.error
  }
}

/**
 * Process the queue with rate limiting
 */
async function processQueue() {
  if (isProcessing) return
  
  isProcessing = true
  console.log('🚀 Starting queue processing...')
  
  try {
    while (requestQueue.length > 0) {
      // Get next batch (up to MAX_CONCURRENT)
      const batch = requestQueue
        .filter(item => item.status === 'queued')
        .slice(0, MAX_CONCURRENT)
      
      if (batch.length === 0) {
        console.log('✅ No more queued items')
        break
      }
      
      console.log(`📦 Processing batch of ${batch.length} items`)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (item, index) => {
        try {
          // Add delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, index * 500))
          
          item.status = 'processing'
          console.log(`🔄 Processing ${item.type} (${item.id})`)
          
          const result = await callGroqAPI(item.prompt)
          
          item.status = 'completed'
          item.result = result
          item.completedAt = new Date()
          
          console.log(`✅ Completed ${item.type} (${item.id})`)
          
        } catch (error) {
          console.error(`❌ Error processing ${item.id}:`, error)
          item.status = 'error'
          item.error = error.message
        }
      })
      
      await Promise.all(batchPromises)
      
      // Wait 60 seconds before next batch to respect rate limits
      if (requestQueue.some(item => item.status === 'queued')) {
        console.log('⏱️ Waiting 60 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 60000))
      }
    }
    
  } finally {
    isProcessing = false
    console.log('🏁 Queue processing completed')
    
    // Clean up completed items after 10 minutes
    setTimeout(() => {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000)
      const initialLength = requestQueue.length
      
      for (let i = requestQueue.length - 1; i >= 0; i--) {
        const item = requestQueue[i]
        if ((item.status === 'completed' || item.status === 'error') && 
            item.completedAt && item.completedAt < cutoff) {
          requestQueue.splice(i, 1)
        }
      }
      
      if (requestQueue.length < initialLength) {
        console.log(`🧹 Cleaned up ${initialLength - requestQueue.length} old queue items`)
      }
    }, 10 * 60 * 1000)
  }
}

/**
 * Call Groq API with retry logic
 */
async function callGroqAPI(prompt) {
  const maxRetries = 3
  let lastError
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Groq API attempt ${attempt}/${maxRetries}`)
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent, professional output
          top_p: 0.9
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 429) {
          // Rate limit - wait longer and retry
          console.log(`⏰ Rate limited, waiting ${60 * attempt} seconds...`)
          await new Promise(resolve => setTimeout(resolve, 60 * attempt * 1000))
          continue
        }
        
        throw new Error(`Groq API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`)
      }
      
      const data = await response.json()
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from Groq API')
      }
      
      return data.choices[0].message.content.trim()
      
    } catch (error) {
      console.error(`❌ Groq API attempt ${attempt} failed:`, error.message)
      lastError = error
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
      }
    }
  }
  
  throw lastError
}

/**
 * Analyze inspection data to extract key insights
 * CRITICAL: Uses enhanced context about inspection completeness from filterReportForAIAnalysis
 */
function analyzeInspectionData(reportData) {
  const observations = reportData.observations_snapshot || []
  const sections = reportData.sections_snapshot || []
  const stats = reportData.stats || {}
  
  // Use enhanced stats that include inspection context
  const actualCompletionRate = stats.actual_completion_rate || 0
  const originalTotalObs = stats.original_total_observations || 0
  const informationalObs = stats.informational_observations || 0
  const inspectionQuality = stats.inspection_quality || {}
  
  console.log(`📊 Analyzing ${observations.length} actual issues (informational observations already filtered out)`)
  console.log(`🔍 Inspection context: ${originalTotalObs} total observations, ${informationalObs} informational, ${actualCompletionRate}% completion`)
  console.log(`✅ Condition assessment: ${inspectionQuality.condition_assessment}`)
  
  // Calculate severity distribution
  const severityCount = { critical: 0, high: 0, medium: 0, low: 0 }
  const criticalIssues = []
  const defectTypes = {}
  
  observations.forEach(obs => {
    // Count by severity (all observations should have severity since they're filtered)
    if (obs.severity >= 5) {
      severityCount.critical++
      criticalIssues.push(obs)
    } else if (obs.severity >= 4) {
      severityCount.high++
      criticalIssues.push(obs)
    } else if (obs.severity === 3) {
      severityCount.medium++
    } else if (obs.severity >= 1) {
      severityCount.low++
    }
    
    // Count defect types - only actual issues with severity
    if (obs.code && obs.description && obs.severity && obs.severity > 0) {
      const key = `${obs.code}: ${obs.description}`
      defectTypes[key] = (defectTypes[key] || 0) + 1
    }
  })
  
  // Find most common issues (these are now only actual defects, not informational observations)
  const commonIssues = Object.entries(defectTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }))
  
  // Use the ACTUAL completion rate based on sections with any observations
  const completionRate = actualCompletionRate
  
  console.log(`🎯 Analysis complete: ${observations.length} issues, ${criticalIssues.length} critical, ${commonIssues.length} common patterns`)
  
  return {
    totalObservations: observations.length,
    totalSections: sections.length,
    severityCount,
    criticalIssues,
    commonIssues,
    completionRate, // Now uses actual completion rate
    projectName: reportData.project_snapshot?.name || 'Unknown Project',
    reportDate: reportData.created_at,
    
    // Enhanced context
    originalTotalObservations: originalTotalObs,
    informationalObservations: informationalObs,
    inspectionQuality: inspectionQuality
  }
}

/**
 * Create executive summary prompt with proper inspection context
 */
function createExecutiveSummaryPrompt(analysis, reportData) {
  const stats = reportData.stats || {}
  const inspectionQuality = stats.inspection_quality || {}
  
  // Determine inspection completeness and condition assessment
  const actualCompletionRate = stats.actual_completion_rate || 0
  const totalOriginalObs = stats.original_total_observations || 0
  const informationalObs = stats.informational_observations || 0
  const hasDataCollected = totalOriginalObs > 0
  const conditionAssessment = inspectionQuality.condition_assessment || 'unknown'
  
  // Build context about what the data means
  let inspectionContext = ''
  if (conditionAssessment === 'good') {
    inspectionContext = `
IMPORTANT CONTEXT: This inspection collected ${totalOriginalObs} total observations across ${actualCompletionRate}% of sections. 
Of these, ${informationalObs} were informational observations (junctions, line deviations, connections, etc.) and ${analysis.totalObservations} were actual defects requiring attention.
The presence of informational observations with minimal defects indicates a COMPLETED inspection of a drainage system in GOOD CONDITION.`
  } else if (conditionAssessment === 'issues_found') {
    inspectionContext = `
INSPECTION CONTEXT: This inspection collected ${totalOriginalObs} total observations across ${actualCompletionRate}% of sections.
Of these, ${informationalObs} were informational observations and ${analysis.totalObservations} were actual defects requiring attention.`
  }

  return `You are a professional drainage engineer writing an executive summary for a CCTV drainage inspection report.

${inspectionContext}

INSPECTION DATA:
- Project: ${analysis.projectName}
- Actual Defects Found: ${analysis.totalObservations}
- Total Data Points Collected: ${totalOriginalObs}
- Sections Inspected: ${stats.sections_with_any_observations || 0}/${analysis.totalSections}
- Inspection Completion Rate: ${actualCompletionRate}%
- Critical Issues (Severity 4-5): ${analysis.severityCount.critical + analysis.severityCount.high}
- Medium Issues (Severity 3): ${analysis.severityCount.medium}
- Low Issues (Severity 1-2): ${analysis.severityCount.low}

${analysis.totalObservations > 0 ? `
MOST COMMON ISSUES:
${analysis.commonIssues.map(item => `- ${item.issue} (${item.count} occurrences)`).join('\n')}

CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:
${analysis.criticalIssues.slice(0, 5).map(obs => `- ${obs.description || obs.code} (Severity ${obs.severity})`).join('\n')}
` : `
CONDITION ASSESSMENT:
No structural defects or issues requiring remedial works were identified during this comprehensive inspection.
The inspection successfully documented infrastructure elements (junctions, connections, line deviations) confirming proper survey coverage.
This indicates the drainage system is in good operational condition.
`}

Write a professional executive summary (250-400 words) that:

${analysis.totalObservations > 0 ? `
1. Starts with overall condition assessment noting ${analysis.totalObservations} defects found
2. Highlights the most critical findings requiring immediate attention
3. Mentions completion rate (${actualCompletionRate}%) and sections inspected
4. Summarizes the most common defect patterns
5. Concludes with urgency level and next steps
6. Uses professional, non-technical language suitable for management
` : `
1. Starts with POSITIVE condition assessment - system is in good condition
2. Confirms the inspection was comprehensive and complete (${actualCompletionRate}% completion)
3. Notes that infrastructure elements were properly documented
4. Explains that absence of defects indicates good system performance
5. Recommends routine monitoring schedule for future maintenance
6. Uses positive, professional language emphasizing system reliability
`}

${analysis.totalObservations === 0 ? `
CRITICAL: Do NOT suggest the inspection was incomplete or inadequate. The inspection WAS completed successfully.
The absence of defects is POSITIVE news indicating good system condition, not a problem with the inspection.
Focus on the system being in good operational condition and meeting performance standards.
` : ''}

Focus on actionable insights and business impact. Be concise but comprehensive.`
}

/**
 * Estimate token count for a prompt
 */
function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

/**
 * Calculate estimated wait time based on queue position
 */
function calculateEstimatedWait(position = null) {
  const queueLength = position || requestQueue.filter(item => item.status === 'queued').length
  
  if (queueLength <= MAX_CONCURRENT) {
    return '30-60 seconds'
  } else {
    const batches = Math.ceil(queueLength / MAX_CONCURRENT)
    const minutes = batches * 1 // 1 minute per batch (including processing time)
    
    if (minutes <= 2) {
      return '1-2 minutes'
    } else if (minutes <= 5) {
      return '3-5 minutes'
    } else {
      return `${minutes} minutes`
    }
  }
}