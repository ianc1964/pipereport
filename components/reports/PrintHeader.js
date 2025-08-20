// components/reports/PrintHeader.js
'use client'

import { Mail, Phone } from 'lucide-react'

export default function PrintHeader({ report, branding }) {
  // Add null checks and default values
  if (!report) return null
  
  const projectData = report?.project_snapshot || {}
  const companyName = branding?.company_name_override || report?.created_by_company?.name || 'Inspection Company'
  const logoUrl = branding?.logo_url || report?.created_by_company?.logo_url
  const reportNumber = report?.report_number || 'Draft Report'
  const projectName = projectData?.name || 'Inspection Report'
  const contactEmail = branding?.contact_email
  const contactNumber = branding?.contact_number
  
  return (
    <>
      <style jsx>{`
        @media screen {
          .print-header-fixed {
            display: none;
          }
        }
        
        @media print {
          .print-header-fixed {
            display: none; /* Hide the fixed header on all pages */
          }
          
          /* Show header only on first page as a regular block element */
          @page :first {
            @top-center {
              content: none; /* Remove any top content on first page */
            }
          }
          
          /* The spacer becomes the actual header on first page only */
          .print-header-spacer {
            display: block;
            padding: 0.1cm 0.25cm;
            border-bottom: 2px solid var(--primary-color, #1e40af);
            margin-bottom: 0.5cm;
            page-break-after: avoid;
          }
          
          .print-header-spacer .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          /* This creates space for the header on the first page */
          .print-header-spacer {
            display: block;
            height: 2cm; /* Header height + clear space */
            width: 100%;
          }
        }
      `}</style>
      
      <div className="print-header-fixed">
        <div className="flex items-center space-x-4">
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={companyName}
              className="h-10 w-auto object-contain"
              style={{ maxHeight: '40px' }}
            />
          )}
          <div>
            <h3 className="font-bold text-base m-0">{companyName}</h3>
            <p className="text-xs text-gray-600 m-0">Professional Inspection Services</p>
            
            {/* Contact details for print */}
            {(contactEmail || contactNumber) && (
              <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                {contactEmail && (
                  <div className="flex items-center">
                    <Mail className="w-3 h-3 mr-1" />
                    <span>{contactEmail}</span>
                  </div>
                )}
                
                {contactNumber && (
                  <div className="flex items-center">
                    <Phone className="w-3 h-3 mr-1" />
                    <span>{contactNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <p className="font-semibold text-sm m-0">{projectName}</p>
          <p className="text-xs text-gray-600 m-0">Report: {reportNumber}</p>
        </div>
      </div>
      
      {/* This spacer is only for the first page, hidden on subsequent pages */}
      <div className="print-header-spacer hidden print:block">
        <div className="header-content">
          <div className="flex items-center space-x-4">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt={companyName}
                className="h-10 w-auto object-contain"
                style={{ maxHeight: '40px' }}
              />
            )}
            <div>
              <h3 className="font-bold text-base m-0">{companyName}</h3>
              <p className="text-xs text-gray-600 m-0">Professional Inspection Services</p>
              
              {/* Contact details for print */}
              {(contactEmail || contactNumber) && (
                <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                  {contactEmail && (
                    <div className="flex items-center">
                      <Mail className="w-3 h-3 mr-1" />
                      <span>{contactEmail}</span>
                    </div>
                  )}
                  
                  {contactNumber && (
                    <div className="flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      <span>{contactNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <p className="font-semibold text-sm m-0">{projectName}</p>
            <p className="text-xs text-gray-600 m-0">Report: {reportNumber}</p>
          </div>
        </div>
      </div>
    </>
  )
}