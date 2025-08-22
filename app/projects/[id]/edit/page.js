'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Upload, X, Building2, User, FileImage, Copy, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function ProjectEditPage() {
  const { user, profile, company, isSuperAdmin, loading: authLoading } = useAuth()
  
  const [formData, setFormData] = useState({
    // Basic Project Info
    name: '',
    description: '',
    status: 'new',
    
    // Site Details
    site_street_address: '',
    site_town_city: '',
    site_region_county: '',
    site_postal_code: '',
    site_contact_name: '',
    site_contact_number: '',
    site_contact_email: '',
    site_image_url: '',
    
    // Client Details
    client_id: '',
    client_same_as_site: false,
    client_name: '',
    client_street_address: '',
    client_town_city: '',
    client_region_county: '',
    client_postal_code: '',
    client_contact_name: '',
    client_contact_number: '',
    client_contact_email: '',
    client_image_url: ''
  })

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingSiteImage, setUploadingSiteImage] = useState(false)
  const [uploadingClientImage, setUploadingClientImage] = useState(false)
  const [showClientImport, setShowClientImport] = useState(false)
  
  const router = useRouter()
  const params = useParams()

  // Handle auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [authLoading, user, router])

  // Load project data and clients
  useEffect(() => {
    let isCancelled = false
    
    const loadProjectAndClients = async () => {
      // Wait for auth to be ready
      if (authLoading || !user) {
        return
      }

      // Check company authorization for non-super admins
      if (!isSuperAdmin && !company?.id) {
        setError('Access denied: No company association found')
        setLoading(false)
        return
      }

      try {
        console.log('🔒 Loading project with company authorization for editing...')

        // 🔒 SECURITY: Load project with company filtering
        let projectQuery = supabase
          .from('projects')
          .select(`
            *,
            companies (
              id,
              name
            )
          `)
          .eq('id', params.id)

        // 🔒 Apply company filtering for non-super admins
        if (!isSuperAdmin && company?.id) {
          console.log('🔒 Applying company filter for edit access:', company.id)
          projectQuery = projectQuery.eq('company_id', company.id)
        }

        const { data: project, error: projectError } = await projectQuery.single()

        if (projectError) {
          console.error('❌ Project query error:', projectError)
          if (projectError.code === 'PGRST116') {
            setError('Project not found or you do not have permission to edit it')
          } else {
            throw projectError
          }
          return
        }

        if (!project) {
          setError('Project not found or access denied')
          return
        }

        console.log('✅ Project loaded with edit authorization')

        if (!isCancelled) {
          // Pre-populate form with project data
          setFormData({
            name: project.name || '',
            description: project.description || '',
            status: project.status || 'new',
            
            site_street_address: project.site_street_address || '',
            site_town_city: project.site_town_city || '',
            site_region_county: project.site_region_county || '',
            site_postal_code: project.site_postal_code || '',
            site_contact_name: project.site_contact_name || '',
            site_contact_number: project.site_contact_number || '',
            site_contact_email: project.site_contact_email || '',
            site_image_url: project.site_image_url || '',
            
            client_id: project.client_id || '',
            client_same_as_site: project.client_same_as_site || false,
            client_name: project.client_name || '',
            client_street_address: project.client_street_address || '',
            client_town_city: project.client_town_city || '',
            client_region_county: project.client_region_county || '',
            client_postal_code: project.client_postal_code || '',
            client_contact_name: project.client_contact_name || '',
            client_contact_number: project.client_contact_number || '',
            client_contact_email: project.client_contact_email || '',
            client_image_url: project.client_image_url || ''
          })
        }

        // Load clients for import functionality
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id) // Clients are still user-specific
          .order('client_name')

        if (clientsError) throw clientsError
        if (!isCancelled) setClients(clientsData || [])

      } catch (error) {
        console.error('❌ Error loading project:', error)
        if (!isCancelled) setError(error.message || 'Failed to load project')
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadProjectAndClients()
    return () => { isCancelled = true }
  }, [params.id, authLoading, user, company, isSuperAdmin])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleClientSameAsSite = (checked) => {
    setFormData(prev => ({
      ...prev,
      client_same_as_site: checked,
      ...(checked ? {
        client_street_address: prev.site_street_address,
        client_town_city: prev.site_town_city,
        client_region_county: prev.site_region_county,
        client_postal_code: prev.site_postal_code,
        client_contact_name: prev.site_contact_name,
        client_contact_number: prev.site_contact_number,
        client_contact_email: prev.site_contact_email,
        client_image_url: prev.site_image_url
      } : {})
    }))
  }

  const handleClientImport = (client) => {
    setSelectedClient(client)
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.client_name,
      client_street_address: client.street_address || '',
      client_town_city: client.town_city || '',
      client_region_county: client.region_county || '',
      client_postal_code: client.postal_code || '',
      client_contact_name: client.contact_name || '',
      client_contact_number: client.contact_number || '',
      client_contact_email: client.contact_email || '',
      client_image_url: client.image_url || ''
    }))
    setShowClientImport(false)
  }

  const handleImageUpload = async (file, type) => {
    if (!file) return

    const setUploading = type === 'site' ? setUploadingSiteImage : setUploadingClientImage
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`
      const filePath = `project-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      const field = type === 'site' ? 'site_image_url' : 'client_image_url'
      handleInputChange(field, data.publicUrl)

    } catch (error) {
      console.error('Error uploading image:', error)
      setError(`Failed to upload ${type} image: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to update a project')
        return
      }

      // 🔒 SECURITY: Double-check company authorization before update
      if (!isSuperAdmin && !company?.id) {
        setError('Access denied: No company authorization')
        return
      }

      console.log('🔒 Updating project with company authorization...')

      // Prepare the project data
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        
        // Site details
        site_street_address: formData.site_street_address.trim() || null,
        site_town_city: formData.site_town_city.trim() || null,
        site_region_county: formData.site_region_county.trim() || null,
        site_postal_code: formData.site_postal_code.trim() || null,
        site_contact_name: formData.site_contact_name.trim() || null,
        site_contact_number: formData.site_contact_number.trim() || null,
        site_contact_email: formData.site_contact_email.trim() || null,
        site_image_url: formData.site_image_url || null,
        
        // Client details
        client_id: formData.client_id || null,
        client_same_as_site: formData.client_same_as_site,
        client_name: formData.client_name.trim() || null,
        client_street_address: formData.client_street_address.trim() || null,
        client_town_city: formData.client_town_city.trim() || null,
        client_region_county: formData.client_region_county.trim() || null,
        client_postal_code: formData.client_postal_code.trim() || null,
        client_contact_name: formData.client_contact_name.trim() || null,
        client_contact_number: formData.client_contact_number.trim() || null,
        client_contact_email: formData.client_contact_email.trim() || null,
        client_image_url: formData.client_image_url || null,
        
        updated_at: new Date().toISOString()
      }

      // 🔒 SECURITY: Update with company filtering
      let updateQuery = supabase
        .from('projects')
        .update(projectData)
        .eq('id', params.id)

      // 🔒 Apply company filtering for non-super admins
      if (!isSuperAdmin && company?.id) {
        console.log('🔒 Applying company filter for update:', company.id)
        updateQuery = updateQuery.eq('company_id', company.id)
      }

      const { data, error } = await updateQuery.select()

      if (error) {
        console.error('❌ Update error:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Project not found or you do not have permission to edit it')
      }

      console.log('✅ Project updated successfully')

      // If we used client details but no existing client was selected, 
      // optionally save as new client for future use
      if (formData.client_name && !formData.client_id && !formData.client_same_as_site) {
        const clientData = {
          user_id: user.id,
          client_name: formData.client_name.trim(),
          street_address: formData.client_street_address.trim() || null,
          town_city: formData.client_town_city.trim() || null,
          region_county: formData.client_region_county.trim() || null,
          postal_code: formData.client_postal_code.trim() || null,
          contact_name: formData.client_contact_name.trim() || null,
          contact_number: formData.client_contact_number.trim() || null,
          contact_email: formData.client_contact_email.trim() || null,
          image_url: formData.client_image_url || null
        }

        await supabase.from('clients').insert([clientData])
      }

      // Redirect back to the project detail page
      router.push(`/projects/${params.id}`)
      
    } catch (error) {
      console.error('❌ Error updating project:', error)
      setError(error.message || 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  const statusOptions = [
    { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'paused', label: 'Paused', color: 'bg-gray-100 text-gray-800' },
    { value: 'complete', label: 'Complete', color: 'bg-green-100 text-green-800' }
  ]

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show loading while project is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg text-gray-500">Loading project...</div>
      </div>
    )
  }

  // Show error if project couldn't be loaded or no access
  if (error && !formData.name) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link 
          href="/" 
          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link 
          href={`/projects/${params.id}`}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Project
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
        <p className="text-gray-600 mt-2">
          Update your project details, site information, and client data
        </p>
      </div>

      <form onSubmit={handleUpdateProject} className="space-y-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Basic Project Information */}
        <div className="bg-white shadow-sm border rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Project Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
                maxLength={100}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your project (optional)"
                maxLength={500}
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* Site Details */}
        <div className="bg-white shadow-sm border rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Site Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={formData.site_street_address}
                onChange={(e) => handleInputChange('site_street_address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter site address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Town/City
              </label>
              <input
                type="text"
                value={formData.site_town_city}
                onChange={(e) => handleInputChange('site_town_city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter town or city"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region/County
              </label>
              <input
                type="text"
                value={formData.site_region_county}
                onChange={(e) => handleInputChange('site_region_county', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter region or county"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Code
              </label>
              <input
                type="text"
                value={formData.site_postal_code}
                onChange={(e) => handleInputChange('site_postal_code', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter postal code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.site_contact_name}
                onChange={(e) => handleInputChange('site_contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.site_contact_number}
                onChange={(e) => handleInputChange('site_contact_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.site_contact_email}
                onChange={(e) => handleInputChange('site_contact_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact email"
              />
            </div>

            {/* Site Image Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site Image
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {formData.site_image_url ? (
                  <div className="relative">
                    <img 
                      src={formData.site_image_url} 
                      alt="Site" 
                      className="w-32 h-32 object-cover rounded-lg mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange('site_image_url', '')}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0], 'site')}
                      className="hidden"
                      id="site-image-upload"
                    />
                    <label
                      htmlFor="site-image-upload"
                      className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 inline-flex items-center"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingSiteImage ? 'Uploading...' : 'Upload Site Image'}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client Details */}
        <div className="bg-white shadow-sm border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <User className="w-5 h-5 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Client Details</h2>
            </div>
            
            <div className="flex gap-2">
              {clients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClientImport(!showClientImport)}
                  className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 text-sm"
                >
                  Import Client
                </button>
              )}
            </div>
          </div>

          {/* Client Import Section */}
          {showClientImport && (
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-800 mb-3">Select Previous Client</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {clients.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleClientImport(client)}
                    className="text-left p-3 border border-purple-200 rounded-md hover:bg-purple-100"
                  >
                    <div className="font-medium">{client.client_name}</div>
                    <div className="text-sm text-gray-600">{client.contact_email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Same as Site Checkbox */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.client_same_as_site}
                onChange={(e) => handleClientSameAsSite(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Client details are the same as site details
              </span>
              <Copy className="w-4 h-4 ml-2 text-gray-400" />
            </label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Name
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => handleInputChange('client_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter client name"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={formData.client_street_address}
                onChange={(e) => handleInputChange('client_street_address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter client address"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Town/City
              </label>
              <input
                type="text"
                value={formData.client_town_city}
                onChange={(e) => handleInputChange('client_town_city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter town or city"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region/County
              </label>
              <input
                type="text"
                value={formData.client_region_county}
                onChange={(e) => handleInputChange('client_region_county', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter region or county"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Postal Code
              </label>
              <input
                type="text"
                value={formData.client_postal_code}
                onChange={(e) => handleInputChange('client_postal_code', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter postal code"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.client_contact_name}
                onChange={(e) => handleInputChange('client_contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact name"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.client_contact_number}
                onChange={(e) => handleInputChange('client_contact_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact number"
                disabled={formData.client_same_as_site}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.client_contact_email}
                onChange={(e) => handleInputChange('client_contact_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact email"
                disabled={formData.client_same_as_site}
              />
            </div>

            {/* Client Image Upload */}
            {!formData.client_same_as_site && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {formData.client_image_url ? (
                    <div className="relative">
                      <img 
                        src={formData.client_image_url} 
                        alt="Client" 
                        className="w-32 h-32 object-cover rounded-lg mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => handleInputChange('client_image_url', '')}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], 'client')}
                        className="hidden"
                        id="client-image-upload"
                      />
                      <label
                        htmlFor="client-image-upload"
                        className="cursor-pointer bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 inline-flex items-center"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingClientImage ? 'Uploading...' : 'Upload Client Image'}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={saving || !formData.name.trim()}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Updating Project...' : 'Update Project'}
          </button>
          
          <Link
            href={`/projects/${params.id}`}
            className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Update Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Project Update</h3>
        <p className="text-sm text-blue-700">
          Changes will be saved to your project. All sections, videos, and observations will remain unchanged.
        </p>
      </div>
    </div>
  )
}