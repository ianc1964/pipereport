'use client'

import { useState, useEffect } from 'react'
import { X, Save, Calendar, Copy, Film, Upload, Database } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import VideoUpload from './VideoUpload'
import VideoPoolSelector from './VideoPoolSelector'

// Move these component definitions OUTSIDE the main component to prevent re-creation
const EditableDropdown = ({ label, field, value, onChange, options = [], required = false, placeholder = "", halfWidth = false }) => {
  const inputId = `input-${field}`
  const listId = `${field}-options`
  
  return (
    <div className={halfWidth ? "col-span-1" : ""}>
      <label htmlFor={inputId} className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          list={listId}
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={placeholder}
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.id || option.value} value={option.value} />
          ))}
        </datalist>
      </div>
    </div>
  )
}

const Dropdown = ({ label, field, value, onChange, options = [], required = false, halfWidth = false }) => {
  const selectId = `select-${field}`
  const currentValue = value || ''
  const hasOptions = options && options.length > 0
  
  return (
    <div className={halfWidth ? "col-span-1" : ""}>
      <label htmlFor={selectId} className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={selectId}
        value={currentValue}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">-- Select {label} --</option>
        {hasOptions ? (
          options.map((option) => (
            <option key={option.id || option.value} value={option.value}>
              {option.value}
            </option>
          ))
        ) : (
          <option value="" disabled>Loading options...</option>
        )}
      </select>
    </div>
  )
}

const CompactInput = ({ label, field, value, onChange, type = "text", required = false, placeholder = "", step = null, halfWidth = false }) => {
  const inputId = `input-${field}`
  
  return (
    <div className={halfWidth ? "col-span-1" : ""}>
      <label htmlFor={inputId} className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={inputId}
        type={type}
        step={step}
        value={value || ''}
        onChange={(e) => {
          const newValue = type === 'number' 
            ? (e.target.value ? (e.target.value.includes('.') ? parseFloat(e.target.value) : parseInt(e.target.value)) : '')
            : e.target.value
          onChange(field, newValue)
        }}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

export default function SectionDetailsForm({ 
  isOpen, 
  onClose, 
  projectId, 
  sectionData = null, // For editing existing sections
  onSectionSaved 
}) {
  const [loading, setLoading] = useState(false)
  const [dropdownOptions, setDropdownOptions] = useState({})
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false)
  const [nextSectionNumber, setNextSectionNumber] = useState(1)
  const [copiedFromPrevious, setCopiedFromPrevious] = useState(false)
  
  // Video-related states
  const [videoSource, setVideoSource] = useState('none') // 'none', 'upload', 'pool'
  const [showVideoUpload, setShowVideoUpload] = useState(false)
  const [selectedPoolVideo, setSelectedPoolVideo] = useState(null)
  const [videoData, setVideoData] = useState(null)
  
  const [formData, setFormData] = useState({
    // Basic section info
    name: '',
    section_number: 1,
    
    // Start details
    start_ref: '',
    start_type: '',
    start_depth: null,
    start_coordinates: '',
    
    // Finish details
    finish_ref: '',
    finish_type: '',
    finish_depth: null,
    finish_coordinates: '',
    
    // Pipe/section details
    direction: '',
    diameter: '',
    use_type: '',
    material: '',
    shape: '',
    section_type: '',
    
    // Lining details
    lining_type: '',
    lining_material: '',
    
    // Inspection details
    inspection_purpose: '',
    flow_control: '',
    precleaned: '',
    survey_method: '',
    location_type: '',
    inspection_date: new Date().toISOString().split('T')[0],
    weather: '',
    location_if_different: '',
    general_remarks: '',
    
    // Video fields - Initialize as empty to prevent pre-population
    video_url: '',
    video_filename: '',
    video_duration: null,
    video_metadata: null
  })

  // Load dropdown options on mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('dropdown_options')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (error) {
          console.error('Dropdown options error:', error)
          return
        }

        // Group options by category
        const groupedOptions = {}
        data?.forEach(option => {
          if (!groupedOptions[option.category]) {
            groupedOptions[option.category] = []
          }
          groupedOptions[option.category].push(option)
        })
        
        setDropdownOptions(groupedOptions)
        setDropdownsLoaded(true)

        // Set default values only for new sections (if no previous section to copy)
        if (!sectionData && !copiedFromPrevious && data) {
          const defaults = {}
          data.forEach(option => {
            if (option.is_default) {
              defaults[option.category] = option.value
            }
          })
          setFormData(prev => ({ ...prev, ...defaults }))
        }

      } catch (error) {
        console.error('Failed to load dropdown options:', error)
      }
    }

    if (isOpen) {
      setDropdownsLoaded(false)
      loadDropdownOptions()
    }
  }, [isOpen, sectionData, copiedFromPrevious])

  // FIXED: Function to copy previous section data - excludes refs and coordinates
  const copyFromPreviousSection = async () => {
    if (!projectId) return null

    try {
      // Get the most recent section from this project
      const { data: previousSections, error } = await supabase
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('section_number', { ascending: false })
        .limit(1)

      if (error || !previousSections || previousSections.length === 0) {
        console.log('No previous section found or error:', error)
        return null
      }

      const previousSection = previousSections[0]
      console.log('Found previous section to copy from:', previousSection.name)

      // FIXED: Copy all fields EXCEPT start_ref, finish_ref, coordinates, and video data
      const copiedData = {
        // EXPLICITLY EXCLUDE: name, section_number, start_ref, finish_ref, start_coordinates, finish_coordinates, video data
        
        // Copy technical details (but NOT refs or coordinates)
        start_type: previousSection.start_type,
        start_depth: previousSection.start_depth,
        // EXCLUDED: start_ref and start_coordinates - should not be copied
        finish_type: previousSection.finish_type,
        finish_depth: previousSection.finish_depth,
        // EXCLUDED: finish_ref and finish_coordinates - should not be copied
        
        // Copy pipe details
        direction: previousSection.direction,
        diameter: previousSection.diameter,
        use_type: previousSection.use_type,
        material: previousSection.material,
        shape: previousSection.shape,
        section_type: previousSection.section_type,
        
        // Copy lining details
        lining_type: previousSection.lining_type,
        lining_material: previousSection.lining_material,
        
        // Copy inspection details
        inspection_purpose: previousSection.inspection_purpose,
        flow_control: previousSection.flow_control,
        precleaned: previousSection.precleaned,
        survey_method: previousSection.survey_method,
        location_type: previousSection.location_type,
        weather: previousSection.weather,
        location_if_different: previousSection.location_if_different,
        general_remarks: previousSection.general_remarks
        
        // Don't copy inspection_date, video data, refs, or coordinates
      }

      return copiedData
    } catch (error) {
      console.error('Error copying from previous section:', error)
      return null
    }
  }

  // FIXED: Get next section number or populate existing data
  useEffect(() => {
    const initializeForm = async () => {
      if (!projectId || !isOpen) return

      try {
        if (sectionData) {
          // Editing existing section
          setFormData({
            name: sectionData.name || '',
            section_number: sectionData.section_number || 1,
            start_ref: sectionData.start_ref || '',
            start_type: sectionData.start_type || '',
            start_depth: sectionData.start_depth || null,
            start_coordinates: sectionData.start_coordinates || '',
            finish_ref: sectionData.finish_ref || '',
            finish_type: sectionData.finish_type || '',
            finish_depth: sectionData.finish_depth || null,
            finish_coordinates: sectionData.finish_coordinates || '',
            direction: sectionData.direction || '',
            diameter: sectionData.diameter || '',
            use_type: sectionData.use_type || '',
            material: sectionData.material || '',
            shape: sectionData.shape || '',
            section_type: sectionData.section_type || '',
            lining_type: sectionData.lining_type || '',
            lining_material: sectionData.lining_material || '',
            inspection_purpose: sectionData.inspection_purpose || '',
            flow_control: sectionData.flow_control || '',
            precleaned: sectionData.precleaned || '',
            survey_method: sectionData.survey_method || '',
            location_type: sectionData.location_type || '',
            inspection_date: sectionData.inspection_date || new Date().toISOString().split('T')[0],
            weather: sectionData.weather || '',
            location_if_different: sectionData.location_if_different || '',
            general_remarks: sectionData.general_remarks || '',
            video_url: sectionData.video_url || '',
            video_filename: sectionData.video_filename || '',
            video_duration: sectionData.video_duration || null,
            video_metadata: sectionData.video_metadata || null
          })
          
          // Set video source if section has video
          if (sectionData.video_url) {
            setVideoSource('existing')
            setVideoData({
              videoUrl: sectionData.video_url,
              filename: sectionData.video_filename,
              duration: sectionData.video_duration,
              metadata: sectionData.video_metadata
            })
          }
        } else {
          // FIXED: Adding new section - reset all video-related state
          setVideoSource('none')
          setVideoData(null)
          setSelectedPoolVideo(null)
          
          // Get next section number and try to copy previous section
          try {
            const { data, error } = await supabase.rpc('get_next_section_number', {
              project_uuid: projectId
            })

            let newSectionNumber = 1
            if (error) {
              console.error('Error getting next section number:', error)
              // Fallback: count existing sections + 1
              const { data: sectionsData, error: countError } = await supabase
                .from('sections')
                .select('section_number')
                .eq('project_id', projectId)
                .order('section_number', { ascending: false })
                .limit(1)

              if (!countError && sectionsData && sectionsData.length > 0) {
                newSectionNumber = sectionsData[0].section_number + 1
              }
            } else {
              newSectionNumber = data
            }

            setNextSectionNumber(newSectionNumber)

            // Try to copy from previous section
            const copiedData = await copyFromPreviousSection()
            
            if (copiedData) {
              console.log('Copying data from previous section (excluding refs and coordinates)')
              setCopiedFromPrevious(true)
              setFormData(prev => ({
                ...prev,
                section_number: newSectionNumber,
                name: `Section ${newSectionNumber}`,
                ...copiedData,
                // FIXED: Ensure video fields are empty for new sections
                video_url: '',
                video_filename: '',
                video_duration: null,
                video_metadata: null
              }))
            } else {
              // No previous section to copy from
              setFormData(prev => ({
                ...prev,
                section_number: newSectionNumber,
                name: `Section ${newSectionNumber}`,
                // FIXED: Explicitly set video fields to empty
                video_url: '',
                video_filename: '',
                video_duration: null,
                video_metadata: null
              }))
            }
          } catch (rpcError) {
            console.error('RPC function error:', rpcError)
            setNextSectionNumber(1)
            setFormData(prev => ({
              ...prev,
              section_number: 1,
              name: 'Section 1',
              // FIXED: Ensure video fields are empty
              video_url: '',
              video_filename: '',
              video_duration: null,
              video_metadata: null
            }))
          }
        }
      } catch (error) {
        console.error('Error initializing form:', error)
      }
    }

    if (isOpen) {
      initializeForm()
    }
  }, [projectId, isOpen, sectionData])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleVideoUploadComplete = (uploadData) => {
    setVideoData(uploadData)
    setShowVideoUpload(false)
    setFormData(prev => ({
      ...prev,
      video_url: uploadData.videoUrl,
      video_filename: uploadData.filename,
      video_duration: uploadData.duration,
      video_metadata: uploadData.metadata
    }))
  }

  const handlePoolVideoSelect = (poolVideo) => {
    setSelectedPoolVideo(poolVideo)
    setVideoData({
      videoUrl: poolVideo.video_url,
      filename: poolVideo.original_filename,
      duration: poolVideo.duration,
      metadata: poolVideo.metadata,
      poolVideoId: poolVideo.id // Keep track of which pool video was selected
    })
  }

  const prepareDataForSubmission = (data) => {
    const cleanData = { ...data }
    
    // Convert empty strings to null for numeric fields
    if (cleanData.start_depth === '' || cleanData.start_depth === undefined) {
      cleanData.start_depth = null
    } else if (cleanData.start_depth !== null) {
      cleanData.start_depth = parseFloat(cleanData.start_depth)
    }
    
    if (cleanData.finish_depth === '' || cleanData.finish_depth === undefined) {
      cleanData.finish_depth = null
    } else if (cleanData.finish_depth !== null) {
      cleanData.finish_depth = parseFloat(cleanData.finish_depth)
    }
    
    // Convert empty strings to null for other optional fields
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === '') {
        cleanData[key] = null
      }
    })
    
    // Ensure required fields are not null
    if (!cleanData.name || cleanData.name.trim() === '') {
      cleanData.name = `Section ${cleanData.section_number}`
    }
    
    // Add video data if selected from pool
    if (videoSource === 'pool' && selectedPoolVideo) {
      cleanData.video_url = selectedPoolVideo.video_url
      cleanData.video_filename = selectedPoolVideo.original_filename
      cleanData.video_duration = selectedPoolVideo.duration
      cleanData.video_metadata = selectedPoolVideo.metadata
    }
    
    return cleanData
  }

  // FIXED: Enhanced submit with better foreign key constraint handling
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Basic validation - only require start_ref and finish_ref
    if (!formData.start_ref?.trim()) {
      alert('Start Reference is required')
      return
    }
    
    if (!formData.finish_ref?.trim()) {
      alert('Finish Reference is required')
      return
    }

    setLoading(true)
    
    try {
      const cleanedData = prepareDataForSubmission(formData)
      
      let savedSectionId = sectionData?.id
      
      if (sectionData) {
        // Update existing section
        const { error } = await supabase
          .from('sections')
          .update(cleanedData)
          .eq('id', sectionData.id)

        if (error) {
          console.error('Update error:', error)
          throw error
        }
      } else {
        // Create new section
        const insertData = {
          project_id: projectId,
          ...cleanedData
        }
        
        console.log('Attempting to insert:', insertData)
        
        const { data: insertedData, error } = await supabase
          .from('sections')
          .insert([insertData])
          .select()
          .single()

        if (error) {
          console.error('Insert error:', error)
          throw error
        }
        
        savedSectionId = insertedData.id
        console.log('Section created successfully:', insertedData)
      }
      
      // If a pool video was selected, update the video_pool table to mark it as assigned
      if (videoSource === 'pool' && selectedPoolVideo && savedSectionId) {
        const { error: poolUpdateError } = await supabase
          .from('video_pool')
          .update({
            assigned_to_section_id: savedSectionId,
            assigned_at: new Date().toISOString()
          })
          .eq('id', selectedPoolVideo.id)
        
        if (poolUpdateError) {
          console.error('Error updating video pool assignment:', poolUpdateError)
          // Don't throw - the section was saved successfully
        } else {
          console.log('Video pool assignment updated successfully')
        }
      }
      
      const finalData = sectionData 
        ? { ...sectionData, ...cleanedData }
        : { id: savedSectionId, ...cleanedData }
      
      onSectionSaved(finalData)
      onClose()
    } catch (error) {
      console.error('Error saving section:', error)
      
      // More specific error messages
      if (error.message?.includes('23505')) {
        alert('A section with this reference already exists. Please use different start/finish references.')
      } else if (error.message?.includes('23503')) {
        alert('Invalid project reference. Please try again.')
      } else if (error.message?.includes('get_next_section_number')) {
        alert('Error generating section number. Please enter a section number manually.')
      } else {
        alert(`Failed to save section: ${error.message || 'Unknown error'}. Please check all fields and try again.`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Show loading state if dropdowns haven't loaded yet
  if (!dropdownsLoaded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Loading form options...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show video upload modal if active
  if (showVideoUpload) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <VideoUpload
          sectionId={sectionData?.id || 'temp-' + Date.now()}
          onUploadComplete={handleVideoUploadComplete}
          onCancel={() => setShowVideoUpload(false)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {sectionData ? 'Edit Section Details' : 'Add New Section'}
            </h2>
            {copiedFromPrevious && !sectionData && (
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                <Copy className="w-3 h-3" />
                Settings copied (refs excluded)
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          
          {/* Basic Section Info - COMPACT */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <CompactInput 
                label="Section Name" 
                field="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={`Section ${formData.section_number}`}
                halfWidth 
              />
              <CompactInput 
                label="Section Number" 
                field="section_number"
                value={formData.section_number}
                onChange={handleInputChange}
                type="number"
                halfWidth 
              />
            </div>
          </div>

          {/* Video Section - FIXED */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1 flex items-center gap-2">
              <Film className="w-4 h-4" />
              Video
            </h3>
            
            {/* Video source selection */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoSource"
                    value="none"
                    checked={videoSource === 'none' || videoSource === 'existing'}
                    onChange={(e) => {
                      if (!sectionData || !sectionData.video_url) {
                        setVideoSource(e.target.value)
                        setSelectedPoolVideo(null)
                        setVideoData(null)
                      }
                    }}
                    disabled={sectionData && sectionData.video_url}
                    className="text-blue-600"
                  />
                  <span className="text-sm">
                    {sectionData && sectionData.video_url ? 'Keep existing video' : 'No video'}
                  </span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoSource"
                    value="upload"
                    checked={videoSource === 'upload'}
                    onChange={(e) => {
                      setVideoSource(e.target.value)
                      setSelectedPoolVideo(null)
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    Upload new video
                  </span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoSource"
                    value="pool"
                    checked={videoSource === 'pool'}
                    onChange={(e) => {
                      setVideoSource(e.target.value)
                      setVideoData(null)
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Select from pool
                  </span>
                </label>
              </div>

              {/* Show appropriate component based on selection */}
              {videoSource === 'upload' && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {videoData ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Film className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{videoData.filename}</p>
                          <p className="text-xs text-gray-500">
                            Duration: {Math.floor(videoData.duration / 60)}:{String(Math.floor(videoData.duration % 60)).padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoData(null)
                          setFormData(prev => ({
                            ...prev,
                            video_url: '',
                            video_filename: '',
                            video_duration: null,
                            video_metadata: null
                          }))
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowVideoUpload(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Click to upload video
                    </button>
                  )}
                </div>
              )}

              {videoSource === 'pool' && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <VideoPoolSelector
                    projectId={projectId}
                    onSelect={handlePoolVideoSelect}
                    selectedVideoId={selectedPoolVideo?.id}
                  />
                </div>
              )}

              {videoSource === 'existing' && sectionData?.video_url && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {sectionData.video_filename || 'Existing video'}
                      </p>
                      {sectionData.video_duration && (
                        <p className="text-xs text-gray-500">
                          Duration: {Math.floor(sectionData.video_duration / 60)}:{String(Math.floor(sectionData.video_duration % 60)).padStart(2, '0')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - COMPACT */}
            <div className="space-y-4">
              {/* Start Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Start Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <CompactInput 
                    label="Start Ref" 
                    field="start_ref"
                    value={formData.start_ref}
                    onChange={handleInputChange}
                    placeholder="e.g., MH001"
                    required 
                    halfWidth
                  />
                  <Dropdown 
                    label="Type" 
                    field="start_type"
                    value={formData.start_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.start_type || []}
                    halfWidth 
                  />
                  <CompactInput 
                    label="Depth (M)" 
                    field="start_depth"
                    value={formData.start_depth}
                    onChange={handleInputChange}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    halfWidth
                  />
                  <CompactInput 
                    label="Coordinates" 
                    field="start_coordinates"
                    value={formData.start_coordinates}
                    onChange={handleInputChange}
                    placeholder="Lat, Lng"
                    halfWidth
                  />
                </div>
              </div>

              {/* Pipe Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Pipe Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Dropdown 
                    label="Direction" 
                    field="direction"
                    value={formData.direction}
                    onChange={handleInputChange}
                    options={dropdownOptions.direction || []}
                    halfWidth 
                  />
                  <Dropdown 
                    label="Diameter (mm)" 
                    field="diameter"
                    value={formData.diameter}
                    onChange={handleInputChange}
                    options={dropdownOptions.diameter || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Use" 
                    field="use_type"
                    value={formData.use_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.use_type || []}
                    halfWidth 
                  />
                  <Dropdown 
                    label="Material" 
                    field="material"
                    value={formData.material}
                    onChange={handleInputChange}
                    options={dropdownOptions.material || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Shape" 
                    field="shape"
                    value={formData.shape}
                    onChange={handleInputChange}
                    options={dropdownOptions.shape || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Type" 
                    field="section_type"
                    value={formData.section_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.section_type || []} 
                    halfWidth
                  />
                </div>
              </div>

              {/* Lining Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Lining Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Dropdown 
                    label="Lining Type" 
                    field="lining_type"
                    value={formData.lining_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.lining_type || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Lining Material" 
                    field="lining_material"
                    value={formData.lining_material}
                    onChange={handleInputChange}
                    options={dropdownOptions.lining_material || []} 
                    halfWidth
                  />
                </div>
              </div>
            </div>

            {/* Right Column - COMPACT */}
            <div className="space-y-4">
              {/* Finish Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Finish Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <CompactInput 
                    label="Finish Ref" 
                    field="finish_ref"
                    value={formData.finish_ref}
                    onChange={handleInputChange}
                    placeholder="e.g., MH002"
                    required
                    halfWidth
                  />
                  <Dropdown 
                    label="Type" 
                    field="finish_type"
                    value={formData.finish_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.finish_type || []}
                    halfWidth 
                  />
                  <CompactInput 
                    label="Depth (M)" 
                    field="finish_depth"
                    value={formData.finish_depth}
                    onChange={handleInputChange}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    halfWidth
                  />
                  <CompactInput 
                    label="Coordinates" 
                    field="finish_coordinates"
                    value={formData.finish_coordinates}
                    onChange={handleInputChange}
                    placeholder="Lat, Lng"
                    halfWidth
                  />
                </div>
              </div>

              {/* Inspection Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Inspection Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Dropdown 
                    label="Purpose" 
                    field="inspection_purpose"
                    value={formData.inspection_purpose}
                    onChange={handleInputChange}
                    options={dropdownOptions.inspection_purpose || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Flow Control" 
                    field="flow_control"
                    value={formData.flow_control}
                    onChange={handleInputChange}
                    options={dropdownOptions.flow_control || []}
                    halfWidth 
                  />
                  <Dropdown 
                    label="Precleaned" 
                    field="precleaned"
                    value={formData.precleaned}
                    onChange={handleInputChange}
                    options={dropdownOptions.precleaned || []}
                    halfWidth 
                  />
                  <Dropdown 
                    label="Survey Method" 
                    field="survey_method"
                    value={formData.survey_method}
                    onChange={handleInputChange}
                    options={dropdownOptions.survey_method || []} 
                    halfWidth
                  />
                  <Dropdown 
                    label="Location Type" 
                    field="location_type"
                    value={formData.location_type}
                    onChange={handleInputChange}
                    options={dropdownOptions.location_type || []} 
                    halfWidth
                  />
                  <CompactInput 
                    label="Inspection Date" 
                    field="inspection_date"
                    value={formData.inspection_date}
                    onChange={handleInputChange}
                    type="date"
                    halfWidth
                  />
                  <Dropdown 
                    label="Weather" 
                    field="weather"
                    value={formData.weather}
                    onChange={handleInputChange}
                    options={dropdownOptions.weather || []}
                    halfWidth 
                  />
                  <CompactInput 
                    label="Location If Different" 
                    field="location_if_different"
                    value={formData.location_if_different}
                    onChange={handleInputChange}
                    placeholder="Specify if different"
                    halfWidth
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comments - COMPACT */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 border-b pb-1">Comments</h3>
            <div>
              <label htmlFor="general-remarks" className="block text-xs font-medium text-gray-700 mb-1">
                General Remarks
              </label>
              <textarea
                id="general-remarks"
                value={formData.general_remarks || ''}
                onChange={(e) => handleInputChange('general_remarks', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Additional notes, observations, or remarks about this section..."
              />
            </div>
          </div>

          {/* Action Buttons - COMPACT */}
          <div className="flex justify-end gap-2 mt-6 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.start_ref?.trim() || !formData.finish_ref?.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {loading ? 'Saving...' : sectionData ? 'Update Section' : 'Create Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}