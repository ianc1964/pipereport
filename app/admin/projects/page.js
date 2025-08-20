'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { 
  FolderOpen, 
  Search, 
  ChevronLeft, 
  Building2, 
  User,
  Calendar,
  FileText,
  Video,
  Camera,
  ExternalLink,
  Filter,
  Clock,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

export default function AllProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [sortBy, setSortBy] = useState('created_at_desc')
  const [companies, setCompanies] = useState([])
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalSections: 0,
    totalObservations: 0
  })
  const [error, setError] = useState(null)

  const { loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading) {
      loadProjects()
      loadCompanies()
    }
  }, [authLoading])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // First, get basic project data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      // If no projects, set empty state and return
      if (!projectsData || projectsData.length === 0) {
        setProjects([])
        setStats({
          totalProjects: 0,
          activeProjects: 0,
          totalSections: 0,
          totalObservations: 0
        })
        return
      }

      // Get user information
      const userIds = [...new Set(projectsData?.map(p => p.user_id).filter(Boolean))] || []
      let profilesData = []
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, company_id')
          .in('id', userIds)
        profilesData = profiles || []
      }

      // Get sections and observations counts separately
      const projectIds = projectsData?.map(p => p.id) || []
      let sectionCounts = {}
      let observationCounts = {}
      
      // Get section counts
      if (projectIds.length > 0) {
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('sections')
          .select('project_id')
          .in('project_id', projectIds)
        
        if (sectionsError) {
          console.error('Error loading sections:', sectionsError)
        } else if (sectionsData) {
          sectionsData.forEach(section => {
            sectionCounts[section.project_id] = (sectionCounts[section.project_id] || 0) + 1
          })
        }
      }

      // Get observation counts
      if (projectIds.length > 0) {
        try {
          // First get all sections for these projects
          const { data: sectionsForObs, error: sectionsError } = await supabase
            .from('sections')
            .select('id, project_id')
            .in('project_id', projectIds)
          
          if (sectionsError) {
            console.error('Error loading sections for observations:', sectionsError)
          } else if (sectionsForObs && sectionsForObs.length > 0) {
            const sectionIds = sectionsForObs.map(s => s.id)
            
            // Then get observations for these sections
            const { data: observationsData, error: obsError } = await supabase
              .from('observations')
              .select('section_id')
              .in('section_id', sectionIds)
            
            if (obsError) {
              console.error('Error loading observations:', obsError)
            } else if (observationsData) {
              // Map observations back to projects
              observationsData.forEach(obs => {
                const section = sectionsForObs.find(s => s.id === obs.section_id)
                if (section) {
                  observationCounts[section.project_id] = (observationCounts[section.project_id] || 0) + 1
                }
              })
            }
          }
        } catch (obsError) {
          console.error('Error loading observations:', obsError)
        }
      }

      // Get companies data
      const companyIds = [...new Set(profilesData?.map(p => p.company_id).filter(Boolean))] || []
      let companiesData = []
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds)
        companiesData = companies || []
      }

      // Create maps for easy lookup
      const profilesMap = {}
      profilesData?.forEach(profile => {
        profilesMap[profile.id] = profile
      })

      const companiesMap = {}
      companiesData?.forEach(company => {
        companiesMap[company.id] = company
      })

      // Process the data to include counts and related info
      const processedProjects = projectsData?.map(project => {
        const profile = profilesMap[project.user_id] || null
        const company = profile?.company_id ? companiesMap[profile.company_id] : null
        
        return {
          ...project,
          profiles: profile,
          companies: company,
          sections_count: sectionCounts[project.id] || 0,
          observations_count: observationCounts[project.id] || 0
        }
      }) || []

      setProjects(processedProjects)

      // Calculate stats
      const totalSections = processedProjects.reduce((sum, p) => sum + p.sections_count, 0)
      const totalObservations = processedProjects.reduce((sum, p) => sum + p.observations_count, 0)
      const activeProjects = processedProjects.filter(p => p.status === 'in_progress').length

      setStats({
        totalProjects: processedProjects.length,
        activeProjects,
        totalSections,
        totalObservations
      })
    } catch (error) {
      console.error('Error loading projects:', error)
      console.error('Error details:', error.message, error.details, error.hint)
      setError(error.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const deleteProject = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      // Refresh the list
      await loadProjects()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project. It may have related data that needs to be removed first.')
    }
  }

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter(project => {
      const matchesSearch = searchTerm === '' || 
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_street_address?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus
      const matchesCompany = filterCompany === 'all' || 
        project.profiles?.company_id === filterCompany

      return matchesSearch && matchesStatus && matchesCompany
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '')
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '')
        case 'created_at_asc':
          return new Date(a.created_at) - new Date(b.created_at)
        case 'created_at_desc':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'sections_desc':
          return b.sections_count - a.sections_count
        case 'observations_desc':
          return b.observations_count - a.observations_count
        default:
          return 0
      }
    })

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <XCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'complete':
        return 'Complete'
      case 'in_progress':
        return 'In Progress'
      case 'paused':
        return 'Paused'
      default:
        return 'New'
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin" 
                className="text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <FolderOpen className="h-8 w-8 text-gray-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">All Projects</h1>
                  <p className="text-gray-600">
                    {filteredAndSortedProjects.length} of {projects.length} projects
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                loadProjects()
                loadCompanies()
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalProjects}
                </p>
              </div>
              <FolderOpen className="h-8 w-8 text-gray-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.activeProjects}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sections</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalSections}
                </p>
              </div>
              <Video className="h-8 w-8 text-purple-400 opacity-50" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Observations</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalObservations}
                </p>
              </div>
              <Camera className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error loading projects:</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
              <button
                onClick={() => loadProjects()}
                className="ml-4 text-red-700 hover:text-red-900 underline text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="complete">Complete</option>
            </select>

            {/* Company Filter */}
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="all">All Companies</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="sections_desc">Most Sections</option>
              <option value="observations_desc">Most Observations</option>
            </select>
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading projects...</p>
            </div>
          ) : filteredAndSortedProjects.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No projects found</p>
              {projects.length === 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl mx-auto text-left">
                  <p className="text-sm text-yellow-800 font-medium mb-2">Troubleshooting: No projects visible</p>
                  <p className="text-sm text-yellow-700 mb-3">This could be due to Row Level Security (RLS) policies. To fix this, run the following SQL in your Supabase SQL editor:</p>
                  <pre className="bg-yellow-100 p-3 rounded text-xs overflow-x-auto">
{`-- Allow super admins to see all projects
CREATE POLICY "Super admins can view all projects" ON projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);`}
                  </pre>
                  <p className="text-sm text-yellow-700 mt-3">If projects still don't appear, check if any projects exist in your database.</p>
                </div>
              )}
              {projects.length > 0 && stats.totalSections === 0 && stats.totalObservations === 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl mx-auto text-left">
                  <p className="text-sm text-yellow-800 font-medium mb-2">Missing sections and observations data</p>
                  <p className="text-sm text-yellow-700 mb-3">If projects are showing but sections/observations counts are 0, you may need to add RLS policies for those tables too:</p>
                  <pre className="bg-yellow-100 p-3 rounded text-xs overflow-x-auto">
{`-- Allow super admins to see all sections
CREATE POLICY "Super admins can view all sections" ON sections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Allow super admins to see all observations
CREATE POLICY "Super admins can view all observations" ON observations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);`}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company / User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {project.name || 'Untitled Project'}
                          </div>
                          {project.site_street_address && (
                            <div className="text-sm text-gray-500">
                              {project.site_street_address}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900 flex items-center">
                            <Building2 className="h-3 w-3 mr-1 text-gray-400" />
                            {project.companies?.name || 'No company'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <User className="h-3 w-3 mr-1 text-gray-400" />
                            {project.profiles?.full_name || project.profiles?.email || 'Unknown user'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(project.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(project.status)}`}>
                            {getStatusLabel(project.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Video className="h-4 w-4 mr-1" />
                            <span>{project.sections_count}</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Camera className="h-4 w-4 mr-1" />
                            <span>{project.observations_count}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(project.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                            title="View Project"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Project"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* RLS Troubleshooting for sections/observations */}
          {projects.length > 0 && stats.totalSections === 0 && stats.totalObservations === 0 && (
            <div className="p-4 m-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">Sections and observations showing as 0?</p>
              <p className="text-sm text-yellow-700">You may need to add RLS policies. Run this SQL in Supabase:</p>
              <details className="mt-2">
                <summary className="text-sm text-yellow-700 cursor-pointer hover:text-yellow-800">Show SQL commands</summary>
                <pre className="mt-2 bg-yellow-100 p-3 rounded text-xs overflow-x-auto">
{`-- Allow super admins to see all sections
CREATE POLICY "Super admins can view all sections" ON sections
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'super_admin'
));

-- Allow super admins to see all observations
CREATE POLICY "Super admins can view all observations" ON observations
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'super_admin'
));`}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}