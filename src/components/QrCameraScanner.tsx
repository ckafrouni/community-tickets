import type QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from './ui'

const AUTOSTART_KEY = 'door:autostart-camera'

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  const text = error instanceof Error ? error.message : String(error)
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.'
  }
  if (name === 'NotFoundError' || /camera not found/i.test(text)) return 'No camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.'
  return `Could not start the camera: ${text}`
}

/**
 * Live camera QR scanner. `onScan` receives the raw decoded text; the parent
 * decides what to do with it (debouncing, verification, etc.).
 */
export function QrCameraScanner({
  onScan,
  onStart,
  children,
}: {
  onScan: (text: string) => void
  /** Called from the "Start" click, a user gesture (useful to unlock audio). */
  onStart?: () => void
  /** Rendered on top of the video (e.g. scan results). */
  children?: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  async function start() {
    if (!window.isSecureContext) {
      setState('error')
      setError('The camera only works on a secure (https://) address. Open the app using its https link.')
      return
    }
    setState('starting')
    setError('')
    try {
      const { default: Scanner } = await import('qr-scanner')
      if (!scannerRef.current && videoRef.current) {
        scannerRef.current = new Scanner(videoRef.current, (result) => onScanRef.current(result.data), {
          preferredCamera: 'environment',
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
        })
      }
      await scannerRef.current!.start()
      setState('running')
      localStorage.setItem(AUTOSTART_KEY, '1')
      setHasFlash(await scannerRef.current!.hasFlash())
      Scanner.listCameras(true)
        .then(setCameras)
        .catch(() => setCameras([]))
    } catch (e) {
      setState('error')
      setError(cameraErrorMessage(e))
    }
  }

  function stop() {
    scannerRef.current?.stop()
    setState('idle')
    setFlashOn(false)
    localStorage.removeItem(AUTOSTART_KEY)
  }

  async function switchCamera() {
    if (!scannerRef.current || cameras.length < 2) return
    const next = (cameraIndex + 1) % cameras.length
    await scannerRef.current.setCamera(cameras[next].id)
    setCameraIndex(next)
    setHasFlash(await scannerRef.current.hasFlash())
    setFlashOn(false)
  }

  async function toggleFlash() {
    if (!scannerRef.current) return
    await scannerRef.current.toggleFlash()
    setFlashOn(scannerRef.current.isFlashOn())
  }

  useEffect(() => {
    // Resume the camera automatically if it was running last time (permission is remembered).
    if (localStorage.getItem(AUTOSTART_KEY) === '1') void start()
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-slate-200">
            {state === 'error' ? (
              <p className="text-sm">{error}</p>
            ) : (
              <p className="text-sm">Point the camera at the QR code on the ticket.</p>
            )}
            <Button
              size="lg"
              onClick={() => {
                onStart?.()
                void start()
              }}
              disabled={state === 'starting'}
            >
              {state === 'starting' && <Spinner />}
              {state === 'error' ? 'Try again' : 'Start scanning'}
            </Button>
          </div>
        )}
        {children}
      </div>
      {state === 'running' && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={stop}>
            Stop camera
          </Button>
          {cameras.length > 1 && (
            <Button variant="secondary" size="sm" onClick={() => void switchCamera()}>
              Switch camera
            </Button>
          )}
          {hasFlash && (
            <Button variant="secondary" size="sm" onClick={() => void toggleFlash()}>
              {flashOn ? 'Flashlight off' : 'Flashlight on'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
