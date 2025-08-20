'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Edit, Trash2, MapPin, User, Calendar, Video, FileText, Eye, Search, Filter, SortAsc, SortDesc, Building, Settings, Archive } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function EnhancedHomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  )
}

function HomePageContent() {
  const { user, profile, company, loading: authLoading, isSuperAdmin } = useAuth()
  const [allProjects, setAllProjects] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingProject, setDeletingProject] = useState(null)
  const [projectToDelete, setProjectToDelete] = useState(null)
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)
  
  // Sorting and filtering state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('all')
  
  const router = useRouter()

  // Redirect super admins to admin dashboard
  useEffect(() => {
    console.log('=== Super Admin Check ===')
    console.log('authLoading:', authLoading)
    console.log('profile:', profile)
    console.log('profile?.role:', profile?.role)
    console.log('isSuperAdmin:', isSuperAdmin)
    
    if (!authLoading && profile && isSuperAdmin) {
      console.log('Super admin detected, redirecting to /admin')
      // Try window.location for more reliable redirect
      window.location.href = '/admin'
    }
  }, [authLoading, profile, isSuperAdmin])

  useEffect(() => {
    // Only load projects if we have a user and haven't loaded them yet
    // Also skip if user is a super admin (they'll be redirected)
    if (!authLoading && user && !hasLoadedProjects && !isSuperAdmin) {
      loadProjects()
    } else if (!authLoading && !user) {
      // This shouldn't happen as ProtectedRoute should redirect, but just in case
      setLoading(false)
    } else if (!authLoading && hasLoadedProjects) {
      // Auth is done and we've already loaded projects, so no loading
      setLoading(false)
    }
  }, [authLoading, user, hasLoadedProjects, isSuperAdmin])

  const loadProjects = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Load user's projects with enhanced data including observation statistics
      // Exclude archived projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          *,
          sections (
            id,
            name,
            video_url,
            observations (
              id,
              severity,
              code
            )
          )
        `)
        .neq('status', 'archived')  // Exclude archived projects
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading projects:', error)
      } else {
        setAllProjects(projects || [])
        setFilteredProjects(projects || [])
        setHasLoadedProjects(true)
      }

      // Get count of archived projects
      const { count: archiveCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'archived')

      if (archiveCount !== null) {
        setArchivedCount(archiveCount)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort projects whenever search, sort, or filter changes
  useEffect(() => {
    let filtered = [...allProjects]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_street_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_town_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'created_at':
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
        case 'updated_at':
          aValue = new Date(a.updated_at || a.created_at)
          bValue = new Date(b.updated_at || b.created_at)
          break
        case 'sections':
          aValue = a.sections?.length || 0
          bValue = b.sections?.length || 0
          break
        case 'observations':
          aValue = a.sections?.reduce((acc, section) => acc + (section.observations?.length || 0), 0) || 0
          bValue = b.sections?.reduce((acc, section) => acc + (section.observations?.length || 0), 0) || 0
          break
        default:
          aValue = a.created_at
          bValue = b.created_at
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredProjects(filtered)
  }, [allProjects, searchTerm, sortBy, sortOrder, statusFilter])

  const handleDeleteProject = async (projectId) => {
    if (!user) return
    
    setDeletingProject(projectId)
    
    try {
      // Delete the project (cascading deletes will handle sections and observations)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        
      
      if (error) throw error
      
      // Remove from local state
      setAllProjects(prev => prev.filter(p => p.id !== projectId))
      setProjectToDelete(null)
      
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project. Please try again.')
    } finally {
      setDeletingProject(null)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusConfig = (status) => {
    const configs = {
      new: { 
        label: 'New', 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        dot: 'bg-blue-400'
      },
      in_progress: { 
        label: 'In Progress', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        dot: 'bg-yellow-400'
      },
      paused: { 
        label: 'Paused', 
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        dot: 'bg-gray-400'
      },
      complete: { 
        label: 'Complete', 
        color: 'bg-green-100 text-green-800 border-green-200',
        dot: 'bg-green-400'
      }
    }
    return configs[status] || configs.new
  }

  const getProjectStats = (project) => {
    const sectionCount = project.sections?.length || 0
    const videoCount = project.sections?.filter(s => s.video_url)?.length || 0
    const allObservations = project.sections?.flatMap(s => s.observations || []) || []
    const observationCount = allObservations.length
    
    // Calculate severity statistics
    const severityStats = {
      high: allObservations.filter(o => o.severity >= 4).length,
      medium: allObservations.filter(o => o.severity === 3).length,
      low: allObservations.filter(o => o.severity <= 2).length
    }
    
    return { sectionCount, videoCount, observationCount, severityStats }
  }

  const sortOptions = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'updated_at', label: 'Last Updated' },
    { value: 'name', label: 'Name' },
    { value: 'status', label: 'Status' },
    { value: 'sections', label: 'Section Count' },
    { value: 'observations', label: 'Observation Count' }
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'paused', label: 'Paused' },
    { value: 'complete', label: 'Complete' }
  ]

  // Show loading state while checking auth or redirecting super admin
  if (authLoading || (loading && !hasLoadedProjects) || (profile && isSuperAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-500">
            {profile && isSuperAdmin ? 'Redirecting to admin dashboard...' : 'Loading...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Version Banner for Blue-Green Deployment Testing */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-900">
                🚀 Version 2.1.0 - Blue-Green Deployment Test
              </span>
            </div>
            <div className="text-xs bg-blue-100 px-2 py-1 rounded-full text-blue-700">
              {process.env.VERCEL_ENV || 'development'}
            </div>
          </div>
          <div className="text-xs text-blue-600">
            Deployed: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Header with Company Info */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900 mr-4">Your Projects</h1>
            
          </div>
          <div className="flex items-center gap-4">
            <p className="text-gray-600">
              Manage your inspection projects ({filteredProjects.length} of {allProjects.length} active shown)
              {archivedCount > 0 && (
                <span className="ml-2 text-sm">
                  • <Link href="/projects/archived" className="text-blue-600 hover:underline">
                    {archivedCount} archived
                  </Link>
                </span>
              )}
            </p>
            {company?.name && (
              <span className="text-sm text-blue-600 font-medium">
                {company.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          <Link
            href="/projects/archived"
            className="bg-gray-100 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors flex items-center"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived Projects
          </Link>
          {profile?.role === 'company_admin' && (
            <Link
              href="/company-dashboard/settings"
              className="bg-gray-100 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-colors flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Company Settings
            </Link>
          )}
          <Link 
            href="/projects/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
          >
            + New Project
          </Link>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors"
            >
              {sortOrder === 'asc' ? (
                <><SortAsc className="w-4 h-4 mr-2" /> Ascending</>
              ) : (
                <><SortDesc className="w-4 h-4 mr-2" /> Descending</>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map(project => {
            const statusConfig = getStatusConfig(project.status)
            const stats = getProjectStats(project)
            
            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all duration-200 transform hover:-translate-y-1">
                {/* Enhanced Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate mb-2">
                        {project.name}
                      </h3>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConfig.dot}`}></div>
                        {statusConfig.label}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 ml-2">
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => setProjectToDelete(project)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Enhanced Site/Client Info */}
                  <div className="space-y-1.5 mb-3">
                    {project.site_street_address && (
                      <div className="flex items-center text-xs text-gray-600">
                        <MapPin className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                          {project.site_town_city || project.site_street_address}
                        </span>
                      </div>
                    )}
                    
                    {project.client_name && (
                      <div className="flex items-center text-xs text-gray-600">
                        <User className="w-3 h-3 mr-1.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{project.client_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Statistics Grid */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">{stats.sectionCount}</div>
                        <div className="text-gray-500">Sections</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">{stats.videoCount}</div>
                        <div className="text-gray-500">Videos</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">{stats.observationCount}</div>
                        <div className="text-gray-500">Observations</div>
                      </div>
                    </div>
                    
                    {/* Severity Statistics */}
                    {stats.observationCount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center">
                          <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
                          High: {stats.severityStats.high}
                        </span>
                        <span className="flex items-center">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></div>
                          Med: {stats.severityStats.medium}
                        </span>
                        <span className="flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                          Low: {stats.severityStats.low}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-500 mb-3">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(project.created_at)}
                    {project.updated_at && project.updated_at !== project.created_at && (
                      <span className="ml-2">• Updated {formatDate(project.updated_at)}</span>
                    )}
                  </div>
                </div>

                {/* Enhanced Action Button */}
                <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-100">
                  <Link 
                    href={`/projects/${project.id}`}
                    className="block w-full bg-blue-600 text-white text-center py-2 px-3 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
                  >
                    Open Project
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            {allProjects.length === 0 ? (
              <>
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-500 mb-6">
                  Get started by creating your first inspection project.
                </p>
                <Link 
                  href="/projects/new"
                  className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Your First Project
                </Link>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <Search className="mx-auto h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects match your filters</h3>
                <p className="text-gray-500 mb-6">
                  Try adjusting your search terms or filters to find projects.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setSortBy('created_at')
                    setSortOrder('desc')
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Clear All Filters
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white rounded-lg max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "<strong>{projectToDelete.name}</strong>"? 
              This action will permanently delete the project and all of its sections, videos, and observations.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-700">
                <strong>Warning:</strong> This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteProject(projectToDelete.id)}
                disabled={deletingProject === projectToDelete.id}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingProject === projectToDelete.id ? 'Deleting...' : 'Delete Project'}
              </button>
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={deletingProject === projectToDelete.id}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}