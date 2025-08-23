'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Edit, Trash2, MapPin, User, Calendar, Video, FileText, Eye, Search, Filter, 
  SortAsc, SortDesc, Building, Settings, Archive, CheckCircle, TrendingUp, 
  Shield, Clock, BarChart3, Users, Zap, FileCheck, Globe, ArrowRight
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function EnhancedHomePage() {
  const { user, loading: authLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading state while checking auth
  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />
  }

  // Show projects page for authenticated users
  return <HomePageContent />
}

function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-orange-50 opacity-70"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <Image 
                src="/pipereport-logo.png" 
                alt="PipeReport.ai - Automated Pipe Condition Reporting" 
                width={400} 
                height={120}
                priority
                className="h-auto w-auto max-w-full"
              />
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Professional CCTV Inspection
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-orange-500 pb-2 leading-relaxed">
                Reporting Made Simple
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your drainage inspection workflow with AI-powered analysis, 
              automated reporting, and intelligent defect detection.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/auth/signup"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition hover:scale-105 shadow-lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                href="/auth/login"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition"
              >
                Sign In
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-blue-500 mr-2" />
                <span>Enterprise-grade security</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-orange-500 mr-2" />
                <span>Setup in 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Professional Inspections
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Complete workflow management from video upload to final report delivery
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="relative p-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-blue-100 rounded-lg mb-4">
                <Video className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Video Processing</h3>
              <p className="text-gray-600">
                Upload CCTV inspection videos with automatic format detection and intelligent transcoding. 
                Handle multiple formats with bulk upload capabilities.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative p-8 bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-orange-100 rounded-lg mb-4">
                <Zap className="h-7 w-7 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Powered Analysis</h3>
              <p className="text-gray-600">
                Leverage advanced AI for automatic defect detection, severity assessment, and 
                intelligent repair recommendations powered by LLM technology.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative p-8 bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-green-100 rounded-lg mb-4">
                <FileCheck className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Professional Reports</h3>
              <p className="text-gray-600">
                Generate comprehensive PDF-ready reports with executive summaries, detailed observations, 
                and actionable repair recommendations.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="relative p-8 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-purple-100 rounded-lg mb-4">
                <Globe className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Interactive Mapping</h3>
              <p className="text-gray-600">
                Create detailed infrastructure maps with nodes, pipes, and observations. 
                Integrate with Google Maps for accurate geographic visualization.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="relative p-8 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-lg mb-4">
                <Users className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Team Collaboration</h3>
              <p className="text-gray-600">
                Multi-user support with role-based access control. Manage teams, share projects, 
                and collaborate on inspections in real-time.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="relative p-8 bg-gradient-to-br from-pink-50 to-white rounded-2xl border border-pink-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-center w-14 h-14 bg-pink-100 rounded-lg mb-4">
                <BarChart3 className="h-7 w-7 text-pink-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Usage Analytics</h3>
              <p className="text-gray-600">
                Track credit usage, monitor project progress, and gain insights into your 
                inspection operations with comprehensive analytics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple 4-Step Workflow
            </h2>
            <p className="text-xl text-gray-600">
              From inspection to report in minutes, not hours
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mx-auto mb-4 text-2xl font-bold">
                  1
                </div>
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gray-300"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Videos</h3>
              <p className="text-gray-600 text-sm">
                Upload CCTV inspection videos in any format
              </p>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-orange-500 text-white rounded-full mx-auto mb-4 text-2xl font-bold">
                  2
                </div>
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gray-300"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Document Observations</h3>
              <p className="text-gray-600 text-sm">
                Record defects with AI assistance and severity scoring
              </p>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full mx-auto mb-4 text-2xl font-bold">
                  3
                </div>
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gray-300"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Map Infrastructure</h3>
              <p className="text-gray-600 text-sm">
                Create visual maps of the inspection area
              </p>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 bg-purple-600 text-white rounded-full mx-auto mb-4 text-2xl font-bold">
                  4
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Generate Report</h3>
              <p className="text-gray-600 text-sm">
                Professional PDF reports with AI summaries
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Inspection Workflow?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of drainage professionals using PipeReport.ai
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/signup"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-blue-600 bg-white rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transform transition hover:scale-105"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/auth/login"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white border-2 border-white rounded-lg hover:bg-white hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="mb-4">© 2025 PipeReport.ai. All rights reserved.</p>
            <p className="text-sm">
              Professional CCTV Inspection Reporting Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
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
  
  // DEBUG: Add state for diagnostic info
  const [debugInfo, setDebugInfo] = useState({})
  
  // Sorting and filtering state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('all')
  
  const router = useRouter()

  // Redirect super admins to admin dashboard
  useEffect(() => {
    if (!authLoading && profile && isSuperAdmin) {
      window.location.href = '/admin'
    }
  }, [authLoading, profile, isSuperAdmin])

  useEffect(() => {
    if (!authLoading && user && !hasLoadedProjects && !isSuperAdmin) {
      loadProjects()
    } else if (!authLoading && !user) {
      setLoading(false)
    } else if (!authLoading && hasLoadedProjects) {
      setLoading(false)
    }
  }, [authLoading, user, hasLoadedProjects, isSuperAdmin, company])

  const loadProjects = async () => {
    if (!user) return
    
    setLoading(true)
    
    // DEBUG: Collect diagnostic information
    const debug = {
      user_id: user?.id,
      profile_role: profile?.role,
      profile_company_id: profile?.company_id,
      company_object: company,
      is_super_admin: isSuperAdmin,
      timestamp: new Date().toISOString()
    }
    
    console.log('=== DIAGNOSTIC INFO ===')
    console.log('User ID:', debug.user_id)
    console.log('Profile Role:', debug.profile_role)
    console.log('Profile Company ID:', debug.profile_company_id)
    console.log('Company Object:', debug.company_object)
    console.log('Is Super Admin:', debug.is_super_admin)
    console.log('========================')
    
    setDebugInfo(debug)
    
    try {
      // Build the query based on user role and company
      let query = supabase
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
          ),
          companies (
            id,
            name
          ),
          profiles (
            id,
            full_name,
            email
          )
        `)
        .neq('status', 'archived')

      // Apply company filtering based on user role
      if (isSuperAdmin) {
        // Super admins see ALL projects across all companies
        console.log('🔧 QUERY: Loading ALL projects for super admin')
      } else if (company?.id) {
        // Company users (both admins and regular users) see only their company's projects
        console.log('🔧 QUERY: Loading projects for company:', company.name, 'ID:', company.id)
        query = query.eq('company_id', company.id)
      } else {
        // User has no company - shouldn't happen but handle gracefully
        console.warn('❌ QUERY: User has no company, loading no projects')
        console.log('Profile company_id:', profile?.company_id)
        console.log('Company object:', company)
        setAllProjects([])
        setFilteredProjects([])
        setHasLoadedProjects(true)
        setLoading(false)
        return
      }

      const { data: projects, error } = await query.order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ Database error loading projects:', error)
        setDebugInfo(prev => ({ ...prev, query_error: error }))
      } else {
        console.log(`✅ Successfully loaded ${projects?.length || 0} projects`)
        
        // DEBUG: Log first few projects to see their company_id values
        if (projects && projects.length > 0) {
          console.log('📋 Sample projects:')
          projects.slice(0, 3).forEach((project, index) => {
            console.log(`  ${index + 1}. ${project.name} (company_id: ${project.company_id})`)
          })
        }
        
        setAllProjects(projects || [])
        setFilteredProjects(projects || [])
        setHasLoadedProjects(true)
        setDebugInfo(prev => ({ ...prev, projects_loaded: projects?.length || 0 }))
      }

      // Load archived count with same company filtering
      let archiveQuery = supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'archived')

      if (!isSuperAdmin && company?.id) {
        archiveQuery = archiveQuery.eq('company_id', company.id)
      }

      const { count: archiveCount } = await archiveQuery

      if (archiveCount !== null) {
        setArchivedCount(archiveCount)
        setDebugInfo(prev => ({ ...prev, archived_count: archiveCount }))
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error)
      setDebugInfo(prev => ({ ...prev, unexpected_error: error.message }))
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort projects
  useEffect(() => {
    let filtered = [...allProjects]

    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_street_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_town_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

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
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        
      if (error) throw error
      
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
      {/* DEBUG: Show diagnostic information when no projects are found */}
      {Object.keys(debugInfo).length > 0 && filteredProjects.length === 0 && (
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">🔍 Diagnostic Information</h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <div><strong>User ID:</strong> {debugInfo.user_id}</div>
            <div><strong>Profile Role:</strong> {debugInfo.profile_role}</div>
            <div><strong>Profile Company ID:</strong> {debugInfo.profile_company_id}</div>
            <div><strong>Company Object:</strong> {debugInfo.company_object ? JSON.stringify(debugInfo.company_object) : 'null'}</div>
            <div><strong>Is Super Admin:</strong> {debugInfo.is_super_admin ? 'Yes' : 'No'}</div>
            <div><strong>Projects Loaded:</strong> {debugInfo.projects_loaded}</div>
            <div><strong>Archived Count:</strong> {debugInfo.archived_count}</div>
            {debugInfo.query_error && (
              <div><strong>Query Error:</strong> {JSON.stringify(debugInfo.query_error)}</div>
            )}
            {debugInfo.unexpected_error && (
              <div><strong>Unexpected Error:</strong> {debugInfo.unexpected_error}</div>
            )}
          </div>
        </div>
      )}

      {/* Header with Company Info */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900 mr-4">
              {isSuperAdmin ? 'All Projects' : 'Company Projects'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-gray-600">
              {isSuperAdmin ? (
                `System-wide project overview (${filteredProjects.length} of ${allProjects.length} shown)`
              ) : (
                `Manage your company's inspection projects (${filteredProjects.length} of ${allProjects.length} active shown)`
              )}
              {archivedCount > 0 && (
                <span className="ml-2 text-sm">
                  • <Link href="/projects/archived" className="text-blue-600 hover:underline">
                    {archivedCount} archived
                  </Link>
                </span>
              )}
            </p>
            {company?.name && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                <Building className="w-3 h-3 mr-1" />
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
      
      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map(project => {
            const statusConfig = getStatusConfig(project.status)
            const stats = getProjectStats(project)
            
            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all duration-200 transform hover:-translate-y-1">
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
                      {/* Show company name for super admins */}
                      {isSuperAdmin && project.companies?.name && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            <Building className="w-3 h-3 mr-1" />
                            {project.companies.name}
                          </span>
                        </div>
                      )}
                      {/* Show creator for company context */}
                      {project.profiles?.full_name && (
                        <div className="mt-1 text-xs text-gray-500">
                          Created by {project.profiles.full_name}
                        </div>
                      )}
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isSuperAdmin ? 'No projects in system' : 'No company projects yet'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {isSuperAdmin 
                    ? 'No projects have been created by any company yet.'
                    : 'Get started by creating your first inspection project.'
                  }
                </p>
                {!isSuperAdmin && (
                  <Link 
                    href="/projects/new"
                    className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
                  >
                    <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Your First Project
                  </Link>
                )}
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

      {/* Delete Confirmation Modal */}
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