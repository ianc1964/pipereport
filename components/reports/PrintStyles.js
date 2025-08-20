// components/reports/PrintStyles.js
'use client'

export default function PrintStyles({ expandedSections = {} }) {
  const printCSS = `
    @media print {
      /* Base print settings */
      * {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
      
      /* Page setup */
            @page {
              size: A4;
              margin: 2.5cm 0.25cm 2.5cm 0.25cm; /* Back to original margins */
              
              /* Page numbers in footer */
              @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: Arial, sans-serif;
                font-size: 10pt;
                color: #666;
              }
            }
      
      /* IMPORTANT: The fixed header is positioned at top: 0 and needs clearance */
      /* All content must have padding-top to avoid overlapping with the header */
      
      /* Ensure the main content container's first child clears the header */
      main > *:first-child,
      .container > *:first-child,
      .max-w-7xl > *:first-child {
        padding-top: 0.1cm !important;
      }
      
      /* Body and typography */
      body {
        margin: 0;
        padding: 0;
        background: white !important;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #000;
      }
      
      /* Hide elements that shouldn't print */
      .no-print,
      button,
      nav,
      [role="navigation"],
      .collapse-button,
      svg.cursor-pointer {
        display: none !important;
      }
      
      /* Show print-only elements */
      .print\\:block {
        display: block !important;
      }
      
      .print\\:flex {
        display: flex !important;
      }
      
      /* Container adjustments */
      .min-h-screen {
        min-height: auto !important;
      }
      
      .max-w-7xl {
        max-width: 100% !important;
      }
      
      /* Headings */
      h1 {
        font-size: 24pt;
        margin: 0 0 16pt 0;
        color: var(--primary-color, #1e40af);
        font-weight: bold;
        page-break-after: avoid;
      }
      
      h2 {
        font-size: 18pt;
        margin: 24pt 0 12pt 0;
        color: var(--primary-color, #1e40af);
        font-weight: bold;
        page-break-after: avoid;
      }
      
      /* Reduce top margin for h2 that starts a new section/page */
      .detailed-findings h2:first-child,
      .map-snapshots h2:first-child,
      .recommendations-section h2:first-child,
      .defect-guide-section h2:first-child,
      .methodology-section h2:first-child {
        margin-top: 0; /* Remove top margin when h2 is first element */
      }

      h3 {
        font-size: 14pt;
        margin: 18pt 0 8pt 0;
        color: var(--secondary-color, #3b82f6);
        font-weight: bold;
        page-break-after: avoid;
      }
      
      h4 {
        font-size: 12pt;
        margin: 12pt 0 6pt 0;
        font-weight: bold;
        page-break-after: avoid;
      }
      
      p {
        margin: 0 0 8pt 0;
        orphans: 3;
        widows: 3;
      }
      
      /* Page break controls */
      .page-break {
        page-break-after: always;
      }
      
      .page-break-before {
        page-break-before: always;
        padding-top: 2cm; /* Clear the header on new page */
      }
      
      .page-break-after-details {
        page-break-after: always;
      }
      
      .page-break-after-observations {
        page-break-after: always;
      }
      
      .avoid-break {
        page-break-inside: avoid;
      }
      
      /* Ensure all elements that start a new page clear the header */
      [class*="page-break-before"] {
        padding-top: 2cm !important;
      }
      
      /* Also handle sections that force new pages */
      .detailed-findings,
      .map-snapshots,
      .recommendations-section,
      .defect-guide-section,
      .methodology-section,
      .table-of-contents,
      .project-overview {
        padding-top: 2cm;
      }
      
      /* Table of Contents specific */
      .table-of-contents {
        page-break-after: always;
        margin-bottom: 2cm;
        padding-top: 2cm; /* Clear the header */
      }
      
      .toc-entry {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8pt;
        position: relative;
        align-items: baseline;
      }
      
      .toc-dots {
        flex: 1;
        border-bottom: 1px dotted #999;
        margin: 0 8pt;
        position: relative;
        top: -4pt;
      }
      
      .toc-title {
        background: white;
        padding-right: 4pt;
      }
      
      .toc-page {
        background: white;
        padding-left: 4pt;
      }
      
      /* Section spacing */
      .report-section {
        margin-bottom: 1.5cm;
        page-break-inside: avoid;
      }
      
      .report-section:first-child {
        padding-top: 2cm; /* Clear the header for first section */
      }
      
      .report-section:last-child {
        margin-bottom: 0;
      }
      
      /* Specific section page breaks */
      .project-overview {
        padding-top: 2cm; /* Clear the header on first content */
      }
      
      .executive-summary {
        page-break-after: always;
      }
      
      .inspection-summary {
        page-break-after: always;
      }
      
      .detailed-findings {
        page-break-before: always;
        padding-top: 0.1cm; /* Clear the header on new page */
      }
      
      .map-snapshots {
        page-break-before: always;
        padding-top: 0.5cm; /* Clear the header on new page */
      }
      
      .recommendations-section {
        page-break-before: always;
        padding-top: 0.5cm; /* Clear the header on new page */
      }
      
      .defect-guide-section {
        page-break-before: always;
        padding-top: 0.5cm; /* Clear the header on new page */
      }
      
      .methodology-section {
        page-break-before: always;
        padding-top: 0.5cm; /* Clear the header on new page */
      }
      
      .limitations-section {
        page-break-before: avoid;
      }


      /* Remove horizontal padding from containers when printing */
      @media print {
        .container,
        .mx-auto,
        .max-w-7xl {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        
        /* Also remove padding from main content area */
        main {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        
        /* And from report sections */
        .report-section {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      }
      
      /* Section details styling for print */
            .section-details-print {
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              padding: 8pt;
              margin-bottom: 12pt;
              page-break-inside: avoid;
              page-break-after: auto;
              font-size: 10pt;
            }
            
            .section-details-print .detail-row {
              display: flex;
              margin-bottom: 4pt;
            }
            
            .section-details-print .detail-label {
              font-weight: bold;
              min-width: 80pt;
              color: #495057;
            }
            
            .section-details-print .detail-value {
              flex: 1;
              color: #212529;
            }
      
      /* Tables */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 12pt 0;
        page-break-inside: avoid;
        font-size: 10pt;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 6pt;
        text-align: left;
      }
      
      th {
        background-color: #f5f5f5;
        font-weight: bold;
      }
      
      /* Images */
      img {
        max-width: 100%;
        height: auto;
        page-break-inside: avoid;
        display: block;
        margin: 12pt auto;
      }
      
      .observation-image {
        max-height: 10cm;
        width: auto;
        object-fit: contain;
      }
      
      .map-snapshot img {
        max-height: 15cm;
        width: auto;
        margin: 0 auto;
      }
      
      /* Traffic light severity colors */
      .bg-red-50, .severity-high {
        background-color: #fef2f2 !important;
        color: #dc2626 !important;
      }
      
      .bg-yellow-50, .severity-medium {
        background-color: #fffbeb !important;
        color: #f59e0b !important;
      }
      
      .bg-green-50, .severity-low {
        background-color: #f0fdf4 !important;
        color: #10b981 !important;
      }
      
      /* Ensure all collapsible content is visible */
      .whitespace-pre-wrap {
        display: block !important;
        white-space: pre-wrap !important;
      }
      
      /* Force expand all CollapsibleSection content */
      section .prose {
        display: block !important;
      }
      
      /* Hide section toggle buttons but not all buttons */
      .collapse-button,
      button.hover\\:bg-gray-50 {
        display: none !important;
      }
      
      /* Show all methodology and limitations content */
      .methodology-section .whitespace-pre-wrap,
      .limitations-section .whitespace-pre-wrap {
        display: block !important;
        white-space: pre-wrap !important;
        font-size: 10pt;
        line-height: 1.4;
      }
      
      /* Force expand all sections in EnhancedDetailedFindings */
      .print-detailed-findings .border-t {
        display: block !important;
      }
      
      /* Ensure sections have proper spacing */
      .print-detailed-findings > div {
        page-break-inside: avoid;
      }
      
      /* First section needs top padding to clear header */
      .print-detailed-findings > div:first-child {
        padding-top: 0cm;
      }
      
      /* Sections that follow a page break also need padding */
      .print-detailed-findings > div:not(:first-child) {
        padding-top: 0cm;
      }
      
      /* Ensure observations are visible */
      .print-detailed-findings .divide-y {
        display: block !important;
      }
      
      /* Ensure observation images print at reasonable size */
      .print-detailed-findings img {
        max-width: 200px !important;
        max-height: 200px !important;
        object-fit: contain !important;
      }

      /* Prevent observations from splitting across pages */
      .print-detailed-findings .divide-y > div {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        padding-bottom: 12pt;
      }

      /* Keep section headers with their content */
      .print-detailed-findings > div > .px-4.py-3:first-child {
        page-break-after: avoid !important;
      }

      /* Pipe graphic - compact height */
      .pipe-graphic {
        height: 1.5cm;
        position: relative;
        margin: 6pt 0;
        page-break-inside: avoid;
        page-break-after: avoid;
      }

      /* Pipe graphic container - minimal padding */
      .print-detailed-findings .px-4.pt-4 {
        padding-top: 6pt !important;
        padding-bottom: 6pt !important;
      }
            
            /* Keep section headers with their content */
            .print-detailed-findings > div > .px-4.py-3:first-child {
              page-break-after: avoid !important;
            }
            
            /* Pipe graphic - compact height */
            .pipe-graphic {
              height: 1.5cm;
              position: relative;
              margin: 6pt 0;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            
            /* Pipe graphic container - minimal padding */
            .print-detailed-findings .px-4.pt-4 {
              padding-top: 6pt !important;
              padding-bottom: 6pt !important;
            }
            
            /* Apply header clearance to elements that can start a new page */
            .print-detailed-findings > div {
              /* This ensures each section that starts a new page clears the header */
              margin-top: 2.5cm;
            }
            
            /* But not if it follows another section on the same page */
            .print-detailed-findings > div:not(:first-child) {
              margin-top: 0;
            }
            
            /* Ensure very first section clears the header */
            .print-detailed-findings > div:first-child {
              margin-top: 0;
              padding-top: 2.5cm;
            }
            
            /* Keep section headers with their content */
            .print-detailed-findings > div > .px-4.py-3:first-child {
              page-break-after: avoid !important;
            }
      
      /* Recommendations styling */
      .recommendation-item {
        page-break-inside: avoid;
        margin-bottom: 12pt;
        padding: 8pt;
        border: 1px solid #ddd;
        background-color: #f9f9f9;
      }
      
      /* Defect guide columns */
      .defect-reference {
        font-size: 9pt;
        columns: 2;
        column-gap: 1cm;
        page-break-inside: avoid;
      }
      
      .defect-item {
        break-inside: avoid;
        margin-bottom: 6pt;
      }
      
      /* Watermark adjustments */
      .watermark {
        opacity: 0.1 !important;
      }
      
      /* Pipe graphic */
            .pipe-graphic {
              height: 1.5cm; /* Reduced from 3cm */
              position: relative;
              margin: 6pt 0; /* Reduced margins */
              page-break-inside: avoid;
              page-break-after: avoid; /* Keep with following observations */
            }
            
            /* Override the padding for pipe graphic container */
            .print-detailed-findings .px-4.pt-4 {
              padding-top: 6pt !important; /* Much smaller padding for pipe graphic container */
            }
      
      /* Ensure pipe graphic and no observations message have proper spacing when starting a new page */
      .pipe-graphic-container,
      .no-observations-message {
        padding-top: 2cm !important;
      }
      
      /* Badge styles */
      .badge {
        display: inline-block;
        padding: 2pt 6pt;
        font-size: 9pt;
        font-weight: bold;
        border-radius: 2pt;
      }
      
      /* Summary statistics grid */
      .grid.grid-cols-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12pt;
      }
      
      .grid.grid-cols-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12pt;
      }
      
      .grid.grid-cols-4 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 12pt;
      }
      
      /* Stat cards */
      .stat-card {
        border: 1px solid #e5e7eb;
        padding: 12pt;
        background-color: #f9fafb;
        page-break-inside: avoid;
      }
      
      /* Hide hover effects */
      .hover\\:bg-gray-50:hover,
      .hover\\:bg-gray-100:hover {
        background-color: transparent !important;
      }
      
      /* Footer styling */
      .report-footer {
        margin-top: 2cm;
        padding-top: 1cm;
        border-top: 1px solid #ccc;
        font-size: 9pt;
        color: #666;
      }
      
      /* Ensure all sections are expanded */
      ${Object.keys(expandedSections).map(id => `#section-${id}`).join(', ')} {
        display: block !important;
      }
      
      /* Override any hidden content */
      [data-print-expanded="true"] {
        display: block !important;
        visibility: visible !important;
        height: auto !important;
        overflow: visible !important;
      }
      
      /* Hide modals when printing */
      .fixed.inset-0.bg-black {
        display: none !important;
      }
    }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />
    </>
  )
}