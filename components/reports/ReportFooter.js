// components/reports/ReportFooter.js
'use client'

import { Shield, Calendar, Building2, FileText } from 'lucide-react'

export default function ReportFooter({ report = {}, branding = {} }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 mt-12 print:mt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main footer content */}
        <div className="text-center text-sm text-gray-600 space-y-3">
          {/* Confidentiality Notice */}
          {branding.show_confidentiality_notice !== false && (
            <div className="flex items-center justify-center text-gray-700">
              <Shield className="w-4 h-4 mr-2 text-gray-400" />
              <p className="font-medium">
                This report is confidential and intended solely for the use of the addressee.
              </p>
            </div>
          )}
          
          {/* Custom Disclaimer */}
          {branding.custom_disclaimer && (
            <p className="text-xs text-gray-500 italic max-w-3xl mx-auto">
              {branding.custom_disclaimer}
            </p>
          )}
          
          {/* Report Generation Info */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Generated on {formatDate(report.created_at)}
            </div>
            
            {branding.company_name_override && (
              <div className="flex items-center">
                <Building2 className="w-3 h-3 mr-1" />
                by {branding.company_name_override}
              </div>
            )}
            
            <div className="flex items-center">
              <FileText className="w-3 h-3 mr-1" />
              Report ID: {report.id?.slice(0, 8) || 'N/A'}
            </div>
          </div>
          
          {/* Page Numbers for Print */}
          <div className="hidden print:block text-xs text-gray-400">
            Page <span className="pageNumber"></span> of <span className="totalPages"></span>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              {branding.company_name_override && (
                <span>© {currentYear} {branding.company_name_override}</span>
              )}
              
              {branding.company_registration && (
                <span>Reg. No: {branding.company_registration}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-4 mt-2 sm:mt-0">
              {branding.company_phone && (
                <span>Tel: {branding.company_phone}</span>
              )}
              
              {branding.company_email && (
                <a 
                  href={`mailto:${branding.company_email}`}
                  className="hover:text-gray-600"
                >
                  {branding.company_email}
                </a>
              )}
              
              {branding.company_website && (
                <a 
                  href={branding.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600"
                >
                  {branding.company_website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          
          {/* Compliance/Certification Info */}
          {branding.certifications && branding.certifications.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400">
                Certified: {branding.certifications.join(' • ')}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Print-specific footer styles */}
      <style jsx>{`
        @media print {
          @page {
            @bottom-right {
              content: counter(page) " of " counter(pages);
            }
          }
        }
      `}</style>
    </footer>
  )
}