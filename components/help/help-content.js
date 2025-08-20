/**
 * Help Content Management System
 * 
 * Centralized help content for the entire application
 * Organized by feature/page for easy maintenance
 */

export const helpContent = {
  // Projects List Page
  projects: {
    createProject: {
      title: "Creating a New Project",
      content: "Start a new infrastructure inspection project to organize your videos, observations, and reports.",
      bullets: [
        "Click 'New Project' to begin",
        "Enter project name and site details",
        "Add client information (optional)",
        "Projects auto-save as you work"
      ]
    },
    projectCard: {
      title: "Project Information",
      content: "Each card shows key project details at a glance.",
      bullets: [
        "Status: New, In Progress, Complete, or Archived",
        "Number of sections (video segments)",
        "Total observations recorded",
        "Click to open project details"
      ]
    },
    archiveProjects: {
      title: "Archived Projects",
      content: "Keep your workspace organized by archiving completed projects. Archived projects are hidden from the main list but can be restored anytime.",
      bullets: [
        "Archive preserves all data",
        "Reduces clutter in main list",
        "Can be restored at any time",
        "Includes audit trail of who/when"
      ]
    },
    bulkUpload: {
      title: "Bulk Video Upload",
      content: "Upload multiple videos at once to a project pool for later assignment to sections.",
      bullets: [
        "Upload up to 10 videos at once",
        "Videos stored in project pool",
        "Assign to sections as needed",
        "Saves time on large projects",
        "Each video costs 10 credits"
      ]
    }
  },

  // Project Detail Page
  projectDetail: {
    sections: {
      title: "Managing Sections",
      content: "Sections represent different segments of your inspection, typically individual pipe runs or areas.",
      bullets: [
        "Each section can have one video",
        "Add observations to specific sections",
        "Sections appear in final report",
        "Name sections clearly (e.g., 'MH1 to MH2')"
      ]
    },
    videoUpload: {
      title: "Video Upload Options",
      content: "Two ways to add videos to sections.",
      bullets: [
        "Direct Upload: Upload new video directly to section (10 credits)",
        "Select from Pool: Choose from previously uploaded videos (no additional cost)",
        "Compatible MP4s upload instantly",
        "Other formats are automatically transcoded to 480p",
        "Maximum file size: 2GB"
      ]
    },
    observations: {
      title: "Recording Observations",
      content: "Document defects and conditions found during inspection.",
      bullets: [
        "Click '+ Add Observation' to record defects",
        "Select predefined observation codes",
        "Set severity: Critical, Major, Minor, or Informational",
        "Capture video frames (1 credit) or upload images (1 credit)",
        "Optional AI analysis for object detection (5 credits)"
      ]
    },
    videoPlayer: {
      title: "Video Player Controls",
      content: "Review inspection videos frame by frame.",
      bullets: [
        "Space bar: Play/Pause",
        "Arrow keys: Frame advance",
        "Scroll: Seek through video",
        "Click timeline: Jump to position",
        "Capture button: Save current frame"
      ]
    }
  },

  // Enhanced Mapping System Help
  mapping: {
    overview: {
      title: "Infrastructure Mapping Overview",
      content: "Create detailed visual representations of your inspected infrastructure using professional mapping tools.",
      bullets: [
        "Switch between Map View (Google Maps) and Canvas Mode (blank drawing)",
        "Add nodes for manholes, chambers, and access points",
        "Draw lines for pipes and connections", 
        "Place observation markers at exact defect locations",
        "Maps automatically included in reports",
        "Use legend to understand all symbols and colors"
      ]
    },
    modes: {
      title: "Map vs Canvas Modes",
      content: "Choose the best background for your mapping needs.",
      bullets: [
        "Map View: Use Google Maps satellite/street view as background",
        "Canvas Mode: Work on blank canvas for schematic drawings",
        "Toggle modes anytime without losing drawings",
        "Map mode ideal for site context and location accuracy",
        "Canvas mode perfect for technical schematics and diagrams"
      ]
    },
    nodes: {
      title: "Node Management",
      content: "Add and manage infrastructure access points and chambers.",
      bullets: [
        "Click Node tool, then click map to place",
        "Choose from predefined types: Manhole, Chamber, Inspection Point",
        "Set custom icons and colors for different node types",
        "Label nodes with reference numbers or names",
        "Click existing nodes to edit properties",
        "Nodes represent manholes, chambers, and access points"
      ]
    },
    lines: {
      title: "Drawing Lines and Pipes",
      content: "Represent pipe networks and connections between infrastructure.",
      bullets: [
        "Click Line tool, then click points to draw pipe routes",
        "Connect lines to nodes to show pipe network",
        "Set line colors and thickness",
        "Label lines with pipe diameters or reference codes",
        "Double-click to finish drawing a line",
        "Lines represent actual pipe runs and connections"
      ]
    },
    drawingTools: {
      title: "Drawing Tools",
      content: "Professional drawing tools for annotations and markings.",
      bullets: [
        "Rectangle: Draw square and rectangular areas",
        "Circle: Mark circular areas or pipe sections",
        "Polygon: Create custom shaped areas",
        "Text: Add labels, measurements, and notes",
        "Freehand: Draw curves and irregular shapes",
        "All drawings can be moved, resized, and rotated after creation"
      ]
    },
    transform: {
      title: "Moving and Editing Drawings",
      content: "Modify drawings after they're created with transform tools.",
      bullets: [
        "Click any drawing to select it (shows handles)",
        "Drag center to move drawings",
        "Drag corner handles to resize",
        "Drag rotation handle to rotate",
        "Press 'Delete' key to remove selected drawings",
        "Multi-select with Ctrl+click or selection box"
      ]
    },
    selection: {
      title: "Selection and Multi-Select",
      content: "Select and manipulate multiple drawings simultaneously.",
      bullets: [
        "Click drawing to select (single selection)",
        "Ctrl+click to add to selection (multi-select)",
        "Press 'M' key to toggle multi-select mode",
        "Drag selection box around multiple items",
        "Selected items shown with blue highlights",
        "Apply operations to all selected items at once"
      ]
    },
    observations: {
      title: "Observation Markers",
      content: "Link observations to exact locations on your map.",
      bullets: [
        "Observation markers appear automatically on map",
        "Color-coded by severity: Red (Critical), Orange (Major), Yellow (Minor), Blue (Info)",
        "Click markers to view observation details",
        "Markers show exact defect locations",
        "Linked to observation database",
        "Included in final report maps"
      ]
    },
    legend: {
      title: "Map Legend",
      content: "Understand all symbols, colors, and markers on your map.",
      bullets: [
        "Shows all node types with icons and descriptions",
        "Displays line types and meanings",
        "Color-coded observation severity levels",
        "Updates automatically as you add elements",
        "Included in report snapshots",
        "Toggle legend visibility as needed"
      ]
    },
    navigation: {
      title: "Map Navigation",
      content: "Move around and zoom your map efficiently.",
      bullets: [
        "Mouse wheel: Zoom in and out",
        "Click and drag: Pan around the map",
        "Double-click: Zoom to location",
        "Zoom controls: Use +/- buttons",
        "Fit to view: Auto-zoom to show all drawings",
        "Reset view: Return to original position"
      ]
    },
    shortcuts: {
      title: "Mapping Keyboard Shortcuts",
      content: "Speed up your mapping workflow with keyboard shortcuts.",
      bullets: [
        "M: Toggle multi-select mode",
        "Delete/Backspace: Remove selected drawings",
        "Ctrl+Z: Undo last action",
        "Ctrl+Y: Redo action",
        "Esc: Cancel current drawing operation",
        "Space: Pan map (hold and drag)"
      ]
    },
    undoRedo: {
      title: "Undo and Redo",
      content: "Easily correct mistakes and experiment with designs.",
      bullets: [
        "Ctrl+Z: Undo last action",
        "Ctrl+Y or Ctrl+Shift+Z: Redo action",
        "Tracks all drawing operations",
        "Unlimited undo/redo history during session",
        "Operations include: add, move, delete, edit",
        "History clears when page is refreshed"
      ]
    },
    reports: {
      title: "Maps in Reports",
      content: "Your maps are automatically included in generated reports.",
      bullets: [
        "Current map view captured in reports",
        "Includes all drawings, nodes, and observation markers",
        "Legend included for context",
        "High-resolution capture for print quality",
        "Zoom and position map before generating report",
        "Multiple map views can be saved for different report sections"
      ]
    }
  },

  // Observation Form
  observationForm: {
    observationCode: {
      title: "Observation Codes",
      content: "Standardized codes for consistent defect classification.",
      bullets: [
        "Select from predefined industry-standard codes",
        "Codes determine report formatting",
        "Consistent coding improves report quality",
        "Custom codes can be added by admin"
      ]
    },
    severity: {
      title: "Severity Levels",
      content: "Rate the importance and urgency of each defect.",
      bullets: [
        "Critical: Immediate action required",
        "Major: Significant issue needing attention",
        "Minor: Small defect for future maintenance",
        "Informational: Note for reference only"
      ]
    },
    imageCapture: {
      title: "Evidence Capture",
      content: "Document defects with visual evidence.",
      bullets: [
        "Capture Frame: Grab image from video (1 credit)",
        "Upload Image: Add external photo (1 credit)",
        "Images automatically linked to observation",
        "Multiple images can be added per observation"
      ]
    },
    aiAnalysis: {
      title: "AI-Powered Analysis",
      content: "Use artificial intelligence to detect objects and read text in images.",
      bullets: [
        "Automatically detects pipe defects",
        "Reads measurements and text (OCR)",
        "Identifies objects in frame",
        "Costs 5 credits per analysis",
        "Results added to observation notes"
      ]
    }
  },

  // Credits System
  credits: {
    balance: {
      title: "Credit Balance",
      content: "Credits are the currency for operations in the system.",
      bullets: [
        "Current balance shown in navigation",
        "Purchase more via Account → Subscription",
        "Company admins can view usage history",
        "Set up alerts for low balance"
      ]
    },
    costs: {
      title: "Credit Costs",
      content: "Different operations consume different amounts of credits.",
      bullets: [
        "Video Upload: 10 credits (or per-MB if configured)",
        "Frame Capture: 1 credit",
        "Image Upload: 1 credit",
        "AI Analysis: 5 credits",
        "Report Generation: Free"
      ]
    },
    purchasing: {
      title: "Purchasing Credits",
      content: "Multiple ways to add credits to your account.",
      bullets: [
        "Buy credit packs in bulk for savings",
        "Subscribe for monthly credit allocation",
        "Company admins manage team credits",
        "Super admins can adjust manually"
      ]
    }
  },

  // Reports
  reports: {
    generation: {
      title: "Generating Reports",
      content: "Create professional PDF reports from your inspection data.",
      bullets: [
        "All project data automatically included",
        "Observations with images and locations",
        "Infrastructure maps and graphics",
        "Company branding applied",
        "Export as PDF or share online"
      ]
    },
    sharing: {
      title: "Sharing Reports",
      content: "Send reports to clients and stakeholders.",
      bullets: [
        "Generate secure share links",
        "Set expiration dates for security",
        "Track who has viewed reports",
        "Recipients don't need accounts",
        "Revoke access anytime"
      ]
    },
    branding: {
      title: "Report Branding",
      content: "Customize reports with your company identity.",
      bullets: [
        "Upload company logo",
        "Set custom colors and fonts",
        "Add header/footer text",
        "Preview before generating",
        "Applied to all company reports"
      ]
    }
  },

  // Company Dashboard
  companyDashboard: {
    users: {
      title: "User Management",
      content: "Manage your team's access and permissions.",
      bullets: [
        "Add new team members via email",
        "Set roles: User or Company Admin",
        "Monitor user activity",
        "Deactivate accounts when needed",
        "View login history and IP addresses"
      ]
    },
    creditHistory: {
      title: "Credit History",
      content: "Track all credit transactions and usage.",
      bullets: [
        "View all credit movements",
        "Filter by type: purchases, usage, adjustments",
        "See who performed each action",
        "Export transaction history",
        "Monitor usage patterns"
      ]
    },
    usageStats: {
      title: "Usage Statistics",
      content: "Analyze how your team uses credits.",
      bullets: [
        "View usage by time period",
        "Breakdown by operation type",
        "Identify heavy users",
        "Optimize credit allocation",
        "Plan future purchases"
      ]
    }
  },

  // Admin Features
  admin: {
    companies: {
      title: "Company Management",
      content: "Super admin tools for managing all companies in the system.",
      bullets: [
        "Create new companies",
        "Manage subscriptions",
        "Adjust credit balances",
        "View all company data",
        "Monitor system usage"
      ]
    },
    pricing: {
      title: "Pricing Configuration",
      content: "Set credit costs for different operations.",
      bullets: [
        "Configure per-operation costs",
        "Set unit-based pricing (per-MB, per-minute)",
        "Apply bulk operation discounts",
        "Test pricing changes",
        "View pricing history"
      ]
    },
    security: {
      title: "Security Monitoring",
      content: "Detect and prevent abuse of the system.",
      bullets: [
        "IP tracking for trial abuse",
        "Device fingerprinting",
        "Suspicious activity alerts",
        "Block abusive accounts",
        "Audit trail of all actions"
      ]
    }
  },

  // General Help
  general: {
    navigation: {
      title: "Navigation",
      content: "Move through the application efficiently.",
      bullets: [
        "Main menu shows available sections",
        "Breadcrumbs show current location",
        "Company logo returns to home",
        "Credits displayed in header",
        "Sign out in top right"
      ]
    },
    shortcuts: {
      title: "Keyboard Shortcuts",
      content: "Speed up your workflow with keyboard shortcuts.",
      bullets: [
        "Space: Play/pause video",
        "←/→: Previous/next frame",
        "↑/↓: Jump 10 seconds",
        "Esc: Close modals",
        "Ctrl/Cmd + S: Save work",
        "Ctrl/Cmd + Z: Undo action"
      ]
    },
    support: {
      title: "Getting Help",
      content: "Resources for when you need assistance.",
      bullets: [
        "Click ℹ️ icons for contextual help",
        "Check notification area for updates",
        "Email support@yourdomain.com",
        "Access training videos in Help menu",
        "Request features via feedback button"
      ]
    }
  }
}

/**
 * Get help content by key path
 * @param {string} path - Dot notation path (e.g., 'projects.createProject')
 * @returns {object} Help content object
 */
export function getHelpContent(path) {
  const keys = path.split('.')
  let content = helpContent
  
  for (const key of keys) {
    if (content[key]) {
      content = content[key]
    } else {
      return null
    }
  }
  
  return content
}

/**
 * Search help content
 * @param {string} query - Search query
 * @returns {array} Array of matching help items
 */
export function searchHelpContent(query) {
  const results = []
  const searchTerm = query.toLowerCase()
  
  function searchObject(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      
      if (value.title && value.content) {
        // This is a help item
        const titleMatch = value.title.toLowerCase().includes(searchTerm)
        const contentMatch = value.content.toLowerCase().includes(searchTerm)
        const bulletsMatch = value.bullets?.some(b => b.toLowerCase().includes(searchTerm))
        
        if (titleMatch || contentMatch || bulletsMatch) {
          results.push({
            path: currentPath,
            ...value,
            relevance: titleMatch ? 3 : contentMatch ? 2 : 1
          })
        }
      } else if (typeof value === 'object') {
        // Recurse into nested objects
        searchObject(value, currentPath)
      }
    }
  }
  
  searchObject(helpContent)
  
  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance)
}

/**
 * Get help content for current page
 * @param {string} pathname - Current page pathname
 * @returns {array} Array of relevant help items
 */
export function getPageHelp(pathname) {
  const helpItems = []
  
  console.log('🔍 Getting help for pathname:', pathname) // Debug log
  
  // Check for specific patterns first
  if (pathname === '/') {
    // Home page - project list
    const paths = ['projects.createProject', 'projects.projectCard', 'projects.archiveProjects']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/projects/new') {
    // New project page
    const paths = ['projects.createProject']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname.startsWith('/projects/') && pathname !== '/projects/new') {
    // Project detail page (dynamic route)
    console.log('🗺️ Project detail page detected, loading mapping help') // Debug log
    const paths = [
      'projectDetail.sections', 
      'projectDetail.videoUpload', 
      'projectDetail.observations', 
      'mapping.overview', 
      'mapping.modes', 
      'mapping.nodes',
      'mapping.lines',
      'mapping.drawingTools',
      'mapping.shortcuts'
    ]
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/company-dashboard') {
    // Company dashboard
    const paths = ['companyDashboard.users', 'companyDashboard.creditHistory', 'companyDashboard.usageStats']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/company-dashboard/users') {
    const paths = ['companyDashboard.users']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/company-dashboard/credits') {
    const paths = ['companyDashboard.creditHistory', 'credits.balance', 'credits.purchasing']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/company-dashboard/usage') {
    const paths = ['companyDashboard.usageStats']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/admin') {
    const paths = ['admin.companies', 'admin.pricing', 'admin.security']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/admin/companies') {
    const paths = ['admin.companies']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/admin/pricing') {
    const paths = ['admin.pricing', 'credits.costs']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  } else if (pathname === '/account/subscription') {
    const paths = ['credits.purchasing', 'credits.balance', 'credits.costs']
    paths.forEach(path => {
      const content = getHelpContent(path)
      if (content) {
        helpItems.push({ path, ...content })
      }
    })
  }
  
  console.log('📚 Found help items:', helpItems.length) // Debug log
  
  return helpItems
}