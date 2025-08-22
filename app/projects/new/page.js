'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, X, Building2, User, FileImage, Copy } from 'lucide-react'
import HelpIcon from '@/components/help/HelpIcon'

export default function EnhancedNewProjectPage() {
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadingSiteImage, setUploadingSiteImage] = useState(false)
  const [uploadingClientImage, setUploadingClientImage] = useState(false)
  const [showClientImport, setShowClientImport] = useState(false)
  
  // Track whether user has manually edited the street address
  const [hasEditedStreetAddress, setHasEditedStreetAddress] = useState(false)
  
  const router = useRouter()

  // Load existing clients for import functionality
  useEffect(() => {
    let isCancelled = false
    
    const loadClients = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || isCancelled) return

        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .order('client_name')

        if (error) throw error
        if (!isCancelled) setClients(data || [])
      } catch (error) {
        console.error('Error loading clients:', error)
      }
    }

    loadClients()
    return () => { isCancelled = true }
  }, [])

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value }
      
      // Auto-populate site address from project name if user hasn't manually edited it
      if (field === 'name' && !hasEditedStreetAddress) {
        newFormData.site_street_address = value
      }
      
      return newFormData
    })
    
    // Track if user manually edits the street address
    if (field === 'site_street_address') {
      setHasEditedStreetAddress(true)
    }
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

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to create a project')
        return
      }

      // Get user's profile and company information
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.company_id) {
        setError('Unable to determine your company. Please contact support.')
        return
      }

      // Prepare the project data
      const projectData = {
        user_id: user.id,
        company_id: profile.company_id,
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
        client_image_url: formData.client_image_url || null
      }

      // Create the project
      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()

      if (error) throw error

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

      // Redirect to the projects page
      router.push('/')
      
    } catch (error) {
      console.error('Error creating project:', error)
      setError(error.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = [
    { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'paused', label: 'Paused', color: 'bg-gray-100 text-gray-800' },
    { value: 'complete', label: 'Complete', color: 'bg-green-100 text-green-800' }
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Projects
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
          <HelpIcon 
            title="Project Creation"
            content="Set up a comprehensive video analysis project with site and client information for professional reporting."
            bullets={[
              "Project Name: Descriptive name for easy identification",
              "Site Details: Location where inspection takes place",
              "Client Details: Who commissioned the work",
              "Images: Photos help with identification and reporting"
            ]}
            modal={true}
          />
        </div>
        <p className="text-gray-600 mt-2">
          Set up a comprehensive video analysis project with site and client details
        </p>
      </div>

      <form onSubmit={handleCreateProject} className="space-y-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Basic Project Information */}
        <div className="bg-white shadow-sm border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Project Information</h2>
            <HelpIcon 
              title="Project Information"
              content="Basic project details for identification and organization."
              bullets={[
                "Name: Clear, descriptive project identifier",
                "Status: Current phase of the project",
                "Description: Brief overview of scope and objectives"
              ]}
              size="sm"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Project Name *
                </label>
                <HelpIcon 
                  title="Project Name"
                  content="Choose a descriptive name that clearly identifies this project (e.g., 'Main Street Drain Survey', 'Industrial Estate CCTV')."
                  bullets={[
                    "Include location or key identifier",
                    "Keep it professional and clear",
                    "Will appear in reports and documentation"
                  ]}
                  size="sm"
                />
              </div>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Main Street Drain Survey"
                maxLength={100}
              />
            </div>

            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <HelpIcon 
                  title="Project Status"
                  content="Track the current phase of your project."
                  bullets={[
                    "New: Just created, not started",
                    "In Progress: Currently being worked on",
                    "Paused: Temporarily stopped",
                    "Complete: Finished and delivered"
                  ]}
                  size="sm"
                />
              </div>
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
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <HelpIcon 
                  title="Project Description"
                  content="Brief overview of the project scope, objectives, or special requirements."
                  size="sm"
                />
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., CCTV inspection of main drainage system following reported blockages"
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
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Site Details</h2>
            <HelpIcon 
              title="Site Details"
              content="Information about the physical location where the inspection or work is taking place."
              bullets={[
                "Address: Exact location of the site",
                "Contact: On-site contact person",
                "Image: Photo of site for identification",
                "Used in reports and for logistics"
              ]}
              size="sm"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Street Address
                </label>
                <HelpIcon 
                  title="Site Address"
                  content="Physical address where the inspection work is taking place. Auto-populated from project name but can be edited."
                  size="sm"
                />
              </div>
              <input
                type="text"
                value={formData.site_street_address}
                onChange={(e) => handleInputChange('site_street_address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 123 Main Street"
              />
              <p className="text-sm text-gray-500 mt-1">
                {hasEditedStreetAddress 
                  ? "You can manually edit this address" 
                  : "Auto-populated from project name, but you can edit"}
              </p>
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
                placeholder="e.g., London"
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
                placeholder="e.g., Greater London"
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
                placeholder="e.g., SW1A 1AA"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <HelpIcon 
                  title="Site Contact"
                  content="On-site contact person who can provide access, answer questions, or coordinate the inspection."
                  size="sm"
                />
              </div>
              <input
                type="text"
                value={formData.site_contact_name}
                onChange={(e) => handleInputChange('site_contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., John Smith"
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
                placeholder="e.g., 07123 456789"
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
                placeholder="e.g., john.smith@example.com"
              />
            </div>

            {/* Site Image Upload */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Site Image
                </label>
                <HelpIcon 
                  title="Site Image"
                  content="Upload a photo of the site to help with identification and include in reports."
                  bullets={[
                    "Helps identify location during field work",
                    "Included in professional reports",
                    "Useful for before/after comparisons",
                    "JPEG, PNG formats accepted"
                  ]}
                  size="sm"
                />
              </div>
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
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Client Details</h2>
              <HelpIcon 
                title="Client Details"
                content="Information about who commissioned the work - may be different from the site location."
                bullets={[
                  "Client: Company or person paying for the work",
                  "May be same as site or different entity",
                  "Used for invoicing and communications",
                  "Appears in professional reports"
                ]}
                size="sm"
              />
            </div>
            
            <div className="flex gap-2">
              {clients.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClientImport(!showClientImport)}
                    className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 text-sm"
                  >
                    Import Client
                  </button>
                  <HelpIcon 
                    title="Import Client"
                    content="Select from previous clients to auto-fill client details and maintain consistency."
                    size="sm"
                  />
                </div>
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
            <div className="flex items-center gap-2">
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
              <HelpIcon 
                title="Same as Site"
                content="Check this if the client and site are the same entity. This will copy all site details to the client section."
                bullets={[
                  "Useful when client owns/manages the site",
                  "Automatically copies address and contact details",
                  "Can still be edited after copying"
                ]}
                size="sm"
              />
            </div>
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
                placeholder="e.g., ABC Property Management Ltd"
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
                placeholder="e.g., 456 Business Street"
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
                placeholder="e.g., Jane Doe"
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
                placeholder="e.g., jane.doe@abcproperty.com"
                disabled={formData.client_same_as_site}
              />
            </div>

            {/* Client Image Upload */}
            {!formData.client_same_as_site && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Image
                  </label>
                  <HelpIcon 
                    title="Client Image"
                    content="Upload client logo or building photo for professional report branding."
                    size="sm"
                  />
                </div>
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
            disabled={loading || !formData.name.trim()}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating Project...' : 'Create Project'}
          </button>
          
          <Link
            href="/"
            className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Next Steps Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Next Steps</h3>
          <HelpIcon 
            title="After Project Creation"
            content="Once your project is created, you can add sections, upload videos, and start your inspection analysis."
            bullets={[
              "Add sections to organize your inspection",
              "Upload videos for analysis",
              "Record observations and findings",
              "Generate professional reports"
            ]}
            size="sm"
          />
        </div>
        <p className="text-sm text-blue-700">
          After creating your project, you'll be able to add sections, upload videos, and start analyzing your content with comprehensive site and client information.
        </p>
      </div>
    </div>
  )
}