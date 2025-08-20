// components/reports/ProjectOverview.js
'use client'

import { 
  MapPin, 
  Building2,
  User,
  Mail,
  Phone,
  CheckCircle,
  Calendar,
  Cloud,
  FileText
} from 'lucide-react'

export default function ProjectOverview({ projectData = {}, report = {} }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Site Details */}
        <div>
          <h3 className="font-medium text-gray-700 mb-3 flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            Site Details
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            {(projectData.site_street_address || projectData.site_town_city) && (
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                <div>
                  {projectData.site_street_address && (
                    <p>{projectData.site_street_address}</p>
                  )}
                  {(projectData.site_town_city || projectData.site_region_county || projectData.site_postal_code) && (
                    <p>
                      {projectData.site_town_city && <span>{projectData.site_town_city}</span>}
                      {projectData.site_town_city && projectData.site_region_county && <span>, </span>}
                      {projectData.site_region_county && <span>{projectData.site_region_county}</span>}
                      {projectData.site_postal_code && <span> {projectData.site_postal_code}</span>}
                    </p>
                  )}
                  {projectData.site_country && (
                    <p>{projectData.site_country}</p>
                  )}
                </div>
              </div>
            )}
            
            {projectData.site_contact_name && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                {projectData.site_contact_name}
              </div>
            )}
            
            {projectData.site_contact_number && (
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                {projectData.site_contact_number}
              </div>
            )}
            
            {projectData.site_contact_email && (
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`mailto:${projectData.site_contact_email}`} className="hover:text-blue-600">
                  {projectData.site_contact_email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Client Information */}
        <div>
          <h3 className="font-medium text-gray-700 mb-3 flex items-center">
            <Building2 className="w-4 h-4 mr-2" />
            Client Information
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            {projectData.client_name && (
              <div className="flex items-center">
                <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                <span className="font-medium">{projectData.client_name}</span>
              </div>
            )}
            
            {projectData.client_contact_name && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                {projectData.client_contact_name}
              </div>
            )}
            
            {projectData.client_contact_number && (
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                {projectData.client_contact_number}
              </div>
            )}
            
            {projectData.client_contact_email && (
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`mailto:${projectData.client_contact_email}`} className="hover:text-blue-600">
                  {projectData.client_contact_email}
                </a>
              </div>
            )}
            
            {(projectData.client_street_address || projectData.client_town_city) && (
              <div className="flex items-start mt-2">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="text-xs">
                  {projectData.client_street_address && (
                    <p>{projectData.client_street_address}</p>
                  )}
                  {(projectData.client_town_city || projectData.client_region_county || projectData.client_postal_code) && (
                    <p>
                      {projectData.client_town_city && <span>{projectData.client_town_city}</span>}
                      {projectData.client_town_city && projectData.client_region_county && <span>, </span>}
                      {projectData.client_region_county && <span>{projectData.client_region_county}</span>}
                      {projectData.client_postal_code && <span> {projectData.client_postal_code}</span>}
                    </p>
                  )}
                  {projectData.client_country && (
                    <p>{projectData.client_country}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Metadata */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <div>
              <span className="text-gray-500">Report Date:</span>
              <span className="ml-2 text-gray-900 font-medium">
                {formatDate(report.created_at)}
              </span>
            </div>
          </div>
          
          {report.weather_conditions && (
            <div className="flex items-center">
              <Cloud className="w-4 h-4 mr-2 text-gray-400" />
              <div>
                <span className="text-gray-500">Weather:</span>
                <span className="ml-2 text-gray-900 font-medium">{report.weather_conditions}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center">
            <FileText className="w-4 h-4 mr-2 text-gray-400" />
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2">
                {report.status === 'final' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Final
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    Draft
                  </span>
                )}
              </span>
            </div>
          </div>
          
          {report.report_template && (
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-gray-400" />
                        <div>
                          <span className="text-gray-500">Format:</span>
                          <span className="ml-2 text-gray-900 font-medium">
                            Comprehensive Report
                          </span>
                        </div>
                      </div>
                    )}
        </div>
        
        {/* Additional metadata if present */}
        {(report.inspection_standards || report.created_by_name) && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {report.inspection_standards && report.inspection_standards.length > 0 && (
              <div>
                <span className="text-gray-500">Inspection Standards:</span>
                <span className="ml-2 text-gray-900">
                  {report.inspection_standards.join(', ')}
                </span>
              </div>
            )}
            
            {report.created_by_name && (
              <div>
                <span className="text-gray-500">Prepared by:</span>
                <span className="ml-2 text-gray-900 font-medium">
                  {report.created_by_name}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}