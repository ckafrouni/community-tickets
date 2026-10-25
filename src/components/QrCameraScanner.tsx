import type QrScanner from 'qr-scanner'
import { Camera, CameraOff, Flashlight, FlashlightOff, ScanLine, SwitchCamera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'

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

export function QrCameraScanner({
  onScan,
  onStart,
  children,
}: {
  onScan: (text: string) => void
  onStart?: () => void
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
    if (localStorage.getItem(AUTOSTART_KEY) === '1') void start()
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-4xl bg-neutral-900">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-neutral-300">
            <ScanLine className="size-10 text-neutral-500" strokeWidth={1.5} />
            <p className="max-w-60 text-[15px]">
              {state === 'error' ? error : 'Point the camera at the QR code on the ticket.'}
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                onStart?.()
                void start()
              }}
              disabled={state === 'starting'}
            >
              {state === 'starting' ? <Spinner /> : <Camera />}
              {state === 'error' ? 'Try again' : 'Start scanning'}
            </Button>
          </div>
        )}
        {children}
      </div>
      {state === 'running' && (
        <div className="mt-3 flex justify-center gap-3">
          <Button variant="secondary" size="icon" onClick={stop} aria-label="Stop camera" title="Stop camera">
            <CameraOff />
          </Button>
          {cameras.length > 1 && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => void switchCamera()}
              aria-label="Switch camera"
              title="Switch camera"
            >
              <SwitchCamera />
            </Button>
          )}
          {hasFlash && (
            <Button
              variant={flashOn ? 'default' : 'secondary'}
              size="icon"
              onClick={() => void toggleFlash()}
              aria-label={flashOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              aria-pressed={flashOn}
            >
              {flashOn ? <FlashlightOff /> : <Flashlight />}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
