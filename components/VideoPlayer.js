'use client'

import { useState, useRef, useEffect, forwardRef } from 'react'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Camera,
  Clock
} from 'lucide-react'

const VideoPlayer = forwardRef(({ 
  src, 
  onCaptureFrame,
  observations = [],
  className = '' 
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimeoutRef = useRef(null)

  // Expose video ref to parent component
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref({ current: videoRef.current })
      } else if (ref.current !== undefined) {
        ref.current = videoRef.current
      }
    }
  }, [ref, videoRef.current])

  const handlePlayPause = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e) => {
    if (!videoRef.current) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  const handleMuteToggle = () => {
    if (!videoRef.current) return

    if (isMuted) {
      videoRef.current.volume = volume
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const handleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  const skipTime = (seconds) => {
    if (!videoRef.current) return
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleCaptureClick = () => {
    console.log('VideoPlayer capture button clicked', { onCaptureFrame, videoRef: videoRef.current, currentTime })
    if (onCaptureFrame && videoRef.current) {
      // Pass the video element and current timestamp
      onCaptureFrame(videoRef.current, currentTime)
    } else {
      console.warn('Cannot capture frame:', { 
        hasCallback: !!onCaptureFrame, 
        hasVideo: !!videoRef.current,
        currentTime 
      })
    }
  }

  const jumpToObservation = (timestamp) => {
    if (!videoRef.current) return
    
    videoRef.current.currentTime = timestamp
    setCurrentTime(timestamp)
  }

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const showControlsTemporarily = () => {
    setShowControls(true)
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  const handleMouseMove = () => {
    showControlsTemporarily()
  }

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false)
    }
  }

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handlePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skipTime(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          skipTime(10)
          break
        case 'f':
          e.preventDefault()
          handleFullscreen()
          break
        case 'm':
          e.preventDefault()
          handleMuteToggle()
          break
        case 'c':
          e.preventDefault()
          handleCaptureClick()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, currentTime, duration])

  if (!src) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">No video uploaded</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Video Player */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
      >
        <video
          ref={videoRef}
          src={src}
          crossOrigin="anonymous"
          className="w-full h-full object-contain"
          onClick={handlePlayPause}
        />

        {/* Observation Markers on Timeline */}
        {observations.length > 0 && duration > 0 && (
          <div className="absolute bottom-16 left-4 right-4">
            <div className="relative h-2 bg-gray-600 rounded">
              {observations.map((obs) => (
                <button
                  key={obs.id}
                  className="absolute w-3 h-3 bg-yellow-400 border-2 border-white rounded-full transform -translate-y-0.5 hover:bg-yellow-300 cursor-pointer"
                  style={{
                    left: `${(obs.video_timestamp / duration) * 100}%`,
                    transform: 'translateX(-50%) translateY(-25%)'
                  }}
                  onClick={() => jumpToObservation(obs.video_timestamp)}
                  title={`Observation: ${obs.name || obs.code} at ${formatTime(obs.video_timestamp)}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div 
          className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Controls - Capture Button */}
          <div className="absolute top-4 right-4 flex gap-2">
            {onCaptureFrame && (
              <button
                onClick={handleCaptureClick}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                title="Capture frame for observation (C)"
              >
                <Camera className="w-4 h-4" />
                Capture Frame
              </button>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress Bar */}
            <div 
              className="w-full h-2 bg-gray-600 rounded cursor-pointer mb-4 hover:h-3 transition-all"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-blue-500 rounded"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Skip Back */}
                <button
                  onClick={() => skipTime(-10)}
                  className="text-white hover:text-blue-300 transition-colors"
                  title="Skip back 10s (←)"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={handlePlayPause}
                  className="text-white hover:text-blue-300 transition-colors"
                  title="Play/Pause (Space)"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>

                {/* Skip Forward */}
                <button
                  onClick={() => skipTime(10)}
                  className="text-white hover:text-blue-300 transition-colors"
                  title="Skip forward 10s (→)"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMuteToggle}
                    className="text-white hover:text-blue-300 transition-colors"
                    title="Mute/Unmute (M)"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-blue-500"
                  />
                </div>

                {/* Time Display */}
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Observation Count */}
                {observations.length > 0 && (
                  <div className="flex items-center gap-1 text-white text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{observations.length} observations</span>
                  </div>
                )}

                {/* Fullscreen */}
                <button
                  onClick={handleFullscreen}
                  className="text-white hover:text-blue-300 transition-colors"
                  title="Fullscreen (F)"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-gray-500 text-center">
        Keyboard shortcuts: Space (play/pause), ← → (skip 10s), F (fullscreen), M (mute), C (capture)
      </div>
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer