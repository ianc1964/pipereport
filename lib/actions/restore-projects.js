'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Restores projects from backup with field name mapping
 * 
 * This handles differences in field names between backup versions and current database schema
 */
export async function restoreProjectsAction({ userId, companyId, backupData }) {
  try {
    console.log('=== RESTORE DEBUG START ===')
    console.log('User ID:', userId)
    console.log('Company ID:', companyId)
    console.log('Backup version:', backupData.backup_version)
    console.log('Projects to restore:', backupData.projects.length)
    
    // Debug first project structure
    if (backupData.projects.length > 0) {
      console.log('First project structure:', JSON.stringify(backupData.projects[0], null, 2).substring(0, 500) + '...')
    }

    // Validate inputs
    if (!userId || !companyId || !backupData || !backupData.projects) {
      return { success: false, error: 'Invalid request parameters' }
    }

    // Verify the user belongs to the company
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('id', userId)
      .single()

    if (profileError || (profile.company_id !== companyId && profile.role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized access' }
    }

    let restoredCount = 0
    const restoredProjects = []
    const errors = []

    // Process each selected project
    for (let i = 0; i < backupData.projects.length; i++) {
      const projectData = backupData.projects[i]
      
      console.log(`\n=== Processing Project ${i + 1} ===`)
      
      // Handle both possible data structures
      const projectInfo = projectData.project || projectData
      
      console.log('Project name:', projectInfo?.name)
      console.log('Project structure keys:', Object.keys(projectData))
      console.log('Has sections?', !!projectData.sections, 'Count:', projectData.sections?.length)
      console.log('Has observations?', !!projectData.observations, 'Count:', projectData.observations?.length)

      try {
        // Skip if conflict resolution is 'skip'
        if (projectData.conflictResolution === 'skip') {
          console.log('Skipping due to conflict resolution')
          continue
        }

        // 1. Create the project
        // Map to the actual database column names
        const projectToCreate = {
          name: projectData.newName || projectInfo.name,
          description: projectInfo.description || '',
          status: projectInfo.status || 'new',
          user_id: userId,
          
          // Site details - map to actual database column names
          site_street_address: projectInfo.site_street_address || null,
          site_town_city: projectInfo.site_town_city || projectInfo.site_city || null,
          site_region_county: projectInfo.site_region_county || projectInfo.site_county || null,
          site_postal_code: projectInfo.site_postal_code || projectInfo.site_postcode || null,
          site_contact_name: projectInfo.site_contact_name || null,
          site_contact_number: projectInfo.site_contact_number || null,
          site_contact_email: projectInfo.site_contact_email || null,
          site_image_url: projectInfo.site_image_url || null,
          
          // Client details - map to actual database column names
          client_id: projectInfo.client_id || null,
          client_same_as_site: projectInfo.client_same_as_site || false,
          client_name: projectInfo.client_name || null,
          client_street_address: projectInfo.client_street_address || null,
          client_town_city: projectInfo.client_town_city || projectInfo.client_city || null,
          client_region_county: projectInfo.client_region_county || projectInfo.client_county || null,
          client_postal_code: projectInfo.client_postal_code || projectInfo.client_postcode || null,
          client_contact_name: projectInfo.client_contact_name || null,
          client_contact_number: projectInfo.client_contact_number || null,
          client_contact_email: projectInfo.client_contact_email || null,
          client_image_url: projectInfo.client_image_url || null
        }

        console.log('Creating project...')
        console.log('Project fields in backup:', Object.keys(projectInfo))
        console.log('Project to create:', projectToCreate)
        const { data: newProject, error: projectError } = await supabaseAdmin
          .from('projects')
          .insert(projectToCreate)
          .select()
          .single()

        if (projectError) {
          console.error('Project creation failed:', projectError)
          throw new Error(`Failed to create project: ${projectError.message}`)
        }

        console.log('✓ Project created with ID:', newProject.id)

        // Track restored project info
        const restoredInfo = {
          projectName: newProject.name,
          projectId: newProject.id,
          sectionsCreated: 0,
          observationsCreated: 0,
          nodesCreated: 0,
          linesCreated: 0,
          drawingsCreated: 0
        }

        // 2. Create sections (mapping old->new section IDs)
        const sectionIdMap = {} // old section id -> new section id
        
        if (projectData.sections && projectData.sections.length > 0) {
          console.log(`\nCreating ${projectData.sections.length} sections...`)
          
          for (let j = 0; j < projectData.sections.length; j++) {
            const section = projectData.sections[j]
            console.log(`  Section ${j + 1}: ${section.name}`)
            
            const sectionToCreate = {
              project_id: newProject.id,
              name: section.name || `Section ${j + 1}`,
              section_number: section.section_number || (j + 1),
              video_url: section.video_url || null,
              video_filename: section.video_filename || null,
              video_duration: section.video_duration || null,
              video_metadata: section.video_metadata || null,
              
              // Section reference fields
              start_ref: section.start_ref || section.start_reference || null,
              finish_ref: section.finish_ref || section.finish_reference || null,
              start_type: section.start_type || null,
              finish_type: section.finish_type || null,
              start_depth: section.start_depth || null,
              finish_depth: section.finish_depth || null,
              start_coordinates: section.start_coordinates || null,
              finish_coordinates: section.finish_coordinates || null,
              
              // Technical fields
              direction: section.direction || null,
              diameter: section.diameter || null,
              use_type: section.use_type || null,
              material: section.material || null,
              shape: section.shape || null,
              section_type: section.section_type || null,
              lining_type: section.lining_type || null,
              lining_material: section.lining_material || null,
              inspection_purpose: section.inspection_purpose || null,
              flow_control: section.flow_control || null,
              precleaned: section.precleaned === true,
              survey_method: section.survey_method || null,
              location_type: section.location_type || null,
              inspection_date: section.inspection_date || null,
              weather: section.weather || null,
              location_if_different: section.location_if_different || null,
              general_remarks: section.general_remarks || null
            }

            const { data: newSection, error: sectionError } = await supabaseAdmin
              .from('sections')
              .insert(sectionToCreate)
              .select()
              .single()

            if (sectionError) {
              console.error(`  ✗ Section creation failed:`, sectionError)
              continue
            }

            console.log(`  ✓ Section created with ID:`, newSection.id)
            sectionIdMap[section.id] = newSection.id
            restoredInfo.sectionsCreated++
          }
        }

        // 3. Create observations (using the section ID mapping)
        if (projectData.observations && projectData.observations.length > 0 && Object.keys(sectionIdMap).length > 0) {
          console.log(`\nCreating ${projectData.observations.length} observations...`)
          
          const observationsToCreate = projectData.observations
            .filter(obs => sectionIdMap[obs.section_id]) // Only create observations for successfully created sections
            .map(obs => ({
              section_id: sectionIdMap[obs.section_id], // Map to new section ID
              name: obs.name || 'Unnamed Observation',
              distance: obs.distance || 0,
              code: obs.code || null,
              description: obs.description || null,
              band: obs.band || null,
              material: obs.material || null,
              is_at_joint: obs.is_at_joint || false,
              clock_ref_1: obs.clock_ref_1 || null,
              clock_ref_2: obs.clock_ref_2 || null,
              loss_percentage: obs.loss_percentage || null,
              dimension_1: obs.dimension_1 || null,
              dimension_2: obs.dimension_2 || null,
              video_ref: obs.video_ref || null,
              photo_ref: obs.photo_ref || null,
              cont_def: obs.cont_def || false,
              severity: obs.severity || null,
              remarks: obs.remarks || null,
              image_url: obs.image_url || null,
              video_timestamp: obs.video_timestamp || null,
              coordinates: obs.coordinates || null,
              metadata: obs.metadata || {}
            }))

          if (observationsToCreate.length > 0) {
            const { data: newObservations, error: obsError } = await supabaseAdmin
              .from('observations')
              .insert(observationsToCreate)
              .select()

            if (obsError) {
              console.error(`✗ Observations creation failed:`, obsError)
            } else {
              console.log(`✓ Created ${newObservations.length} observations`)
              restoredInfo.observationsCreated = newObservations.length
            }
          }
        }

        // 4. Create map configuration
        if (projectData.map) {
          console.log('\nCreating map configuration...')
          
          const mapToCreate = {
            project_id: newProject.id,
            background_type: projectData.map.background_type || 'map',
            background_image_url: projectData.map.background_image_url || null,
            bounds: projectData.map.bounds || null,
            zoom_settings: projectData.map.zoom_settings || null,
            center_lat: projectData.map.center_lat || null,
            center_lng: projectData.map.center_lng || null,
            default_zoom: projectData.map.default_zoom || null
          }

          const { error: mapError } = await supabaseAdmin
            .from('project_maps')
            .insert(mapToCreate)

          if (mapError) {
            console.error('✗ Map creation failed:', mapError)
          } else {
            console.log('✓ Map configuration created')
          }
        }

        // 5. Create nodes (mapping old->new node IDs)
        const nodeIdMap = {} // old node id -> new node id
        
        if (projectData.nodes && projectData.nodes.length > 0) {
          console.log(`\nCreating ${projectData.nodes.length} nodes...`)
          
          for (const node of projectData.nodes) {
            const nodeToCreate = {
              project_id: newProject.id,
              node_ref: node.node_ref || null,
              node_type_code: node.node_type_code || 'MH',
              lat: node.lat,
              lng: node.lng,
              elevation: node.elevation || null,
              cover_level: node.cover_level || null,
              invert_level: node.invert_level || null,
              condition: node.condition || null,
              metadata: node.metadata || {},
              context: node.context || 'map'
            }

            const { data: newNode, error: nodeError } = await supabaseAdmin
              .from('map_nodes')
              .insert(nodeToCreate)
              .select()
              .single()

            if (nodeError) {
              console.error('✗ Node creation failed:', nodeError)
            } else {
              nodeIdMap[node.id] = newNode.id
              restoredInfo.nodesCreated++
            }
          }
          
          console.log(`✓ Created ${restoredInfo.nodesCreated} nodes`)
        }

        // 6. Create lines (using node ID mapping)
        if (projectData.lines && projectData.lines.length > 0 && Object.keys(nodeIdMap).length > 0) {
          console.log(`\nCreating ${projectData.lines.length} lines...`)
          
          const linesToCreate = projectData.lines
            .filter(line => nodeIdMap[line.start_node_id] && nodeIdMap[line.end_node_id])
            .map(line => ({
              project_id: newProject.id,
              section_id: line.section_id && sectionIdMap[line.section_id] ? sectionIdMap[line.section_id] : null,
              start_node_id: nodeIdMap[line.start_node_id],
              end_node_id: nodeIdMap[line.end_node_id],
              waypoints: line.waypoints || null,
              style: line.style || {},
              metadata: line.metadata || {},
              context: line.context || 'map'
            }))

          if (linesToCreate.length > 0) {
            const { data: newLines, error: linesError } = await supabaseAdmin
              .from('map_lines')
              .insert(linesToCreate)
              .select()

            if (linesError) {
              console.error('✗ Lines creation failed:', linesError)
            } else {
              console.log(`✓ Created ${newLines.length} lines`)
              restoredInfo.linesCreated = newLines.length
            }
          }
        }

        // 7. Create drawings
        if (projectData.drawings && projectData.drawings.length > 0) {
          console.log(`\nCreating ${projectData.drawings.length} drawings...`)
          
          const drawingsToCreate = projectData.drawings.map(drawing => ({
            project_id: newProject.id,
            name: drawing.name || 'Unnamed Drawing',
            drawing_type: drawing.drawing_type || 'rectangle',
            geometry: drawing.geometry || {},
            style: drawing.style || {},
            text_content: drawing.text_content || null,
            text_style: drawing.text_style || {},
            layer_name: drawing.layer_name || null,
            z_index: drawing.z_index || 0,
            is_visible: drawing.is_visible !== false,
            context: drawing.context || 'map',
            transform: drawing.transform || null
          }))

          const { data: newDrawings, error: drawingsError } = await supabaseAdmin
            .from('map_drawings')
            .insert(drawingsToCreate)
            .select()

          if (drawingsError) {
            console.error('✗ Drawings creation failed:', drawingsError)
          } else {
            console.log(`✓ Created ${newDrawings.length} drawings`)
            restoredInfo.drawingsCreated = newDrawings.length
          }
        }

        // 8. Verify what was created
        console.log('\nVerifying restoration...')
        
        const { data: verifiedSections } = await supabaseAdmin
          .from('sections')
          .select('id')
          .eq('project_id', newProject.id)
        
        console.log(`✓ Verified ${verifiedSections?.length || 0} sections in database`)
        
        if (verifiedSections && verifiedSections.length > 0) {
          const { count: obsCount } = await supabaseAdmin
            .from('observations')
            .select('*', { count: 'exact', head: true })
            .in('section_id', verifiedSections.map(s => s.id))
          
          console.log(`✓ Verified ${obsCount || 0} observations in database`)
        }

        restoredCount++
        restoredProjects.push(restoredInfo)

      } catch (projectError) {
        console.error('Project restoration error:', projectError)
        errors.push({
          project: projectInfo?.name || 'Unknown project',
          error: projectError.message
        })
      }
    }

    console.log('\n=== RESTORE DEBUG END ===')
    console.log('Total projects restored:', restoredCount)
    console.log('Restored details:', restoredProjects)

    return {
      success: restoredCount > 0,
      restoredCount,
      restoredProjects,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0 
        ? `Restored ${restoredCount} project(s) with errors: ${errors.map(e => e.error).join(', ')}`
        : `Successfully restored ${restoredCount} project(s)`,
      debugInfo: {
        totalProjectsInBackup: backupData.projects.length,
        projectsProcessed: restoredProjects.length + errors.length,
        errorsEncountered: errors
      }
    }

  } catch (error) {
    console.error('FATAL RESTORE ERROR:', error)
    return {
      success: false,
      error: 'Failed to restore projects: ' + error.message
    }
  }
}