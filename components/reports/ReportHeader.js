// components/reports/ReportHeader.js
'use client'

import { Printer, Download, Share2, FileText, Mail, Phone } from 'lucide-react'

export default function ReportHeader({ report = {}, branding = {}, shareSettings = {}, onPrint }) {
  const handleDownload = () => {
    if (!shareSettings?.allow_download) {
      alert('Downloading is not allowed for this report')
      return
    }
    // Future implementation for PDF download
    alert('PDF download feature coming soon')
  }

  const handleShare = () => {
    // Copy current URL to clipboard
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Report link copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy link. Please copy from the address bar.')
    })
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 print:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between">
          {/* Logo and Title Section */}
          <div className="flex items-start space-x-6">
            {branding.logo_url && (
              <div className="flex-shrink-0">
                <img 
                  src={branding.logo_url} 
                  alt={branding.company_name_override || 'Company Logo'}
                  className="h-16 object-contain"
                  style={{ maxWidth: '200px' }}
                />
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {report.title || 'Inspection Report'}
              </h1>
              
              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  <span>Report #{report.report_number}</span>
                </div>
                
                {report.version && report.version > 1 && (
                  <div className="flex items-center">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      Version {report.version}
                    </span>
                  </div>
                )}
                
                {report.status === 'final' && (
                  <div className="flex items-center">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Final Report
                    </span>
                  </div>
                )}
              </div>
              
              {/* Additional metadata */}
              {report.project_name && (
                <p className="mt-2 text-sm text-gray-500">
                  Project: {report.project_name}
                </p>
              )}
            </div>
          </div>
          
          {/* Action buttons - hide in print */}
          <div className="flex items-center space-x-2 print:hidden">
            {shareSettings?.allow_print && (
              <button
                onClick={onPrint}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Print report"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Print
              </button>
            )}
            
            {shareSettings?.allow_download && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Download as PDF"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </button>
            )}
            
            <button
              onClick={handleShare}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Share report link"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              Share
            </button>
          </div>
        </div>
        
        {/* Company info bar */}
        {(branding.company_name_override || branding.company_tagline || branding.contact_email || branding.contact_number) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                {branding.company_name_override && (
                  <p className="text-sm font-medium text-gray-700">
                    {branding.company_name_override}
                  </p>
                )}
                {branding.company_tagline && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {branding.company_tagline}
                  </p>
                )}
                
                {/* Contact details */}
                <div className="mt-2 flex items-center space-x-4">
                  {branding.contact_email && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Mail className="w-3 h-3 mr-1 text-gray-400" />
                      <a 
                        href={`mailto:${branding.contact_email}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {branding.contact_email}
                      </a>
                    </div>
                  )}
                  
                  {branding.contact_number && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Phone className="w-3 h-3 mr-1 text-gray-400" />
                      <a 
                        href={`tel:${branding.contact_number}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {branding.contact_number}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              
              {branding.company_website && (
                <a 
                  href={branding.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {branding.company_website}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}