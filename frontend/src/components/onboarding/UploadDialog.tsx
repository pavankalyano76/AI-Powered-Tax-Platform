import { useRef, useState, type ChangeEvent } from 'react'
import { Upload, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

type Stage = 'idle' | 'uploading' | 'error' | 'success'

export function UploadDialog({
  label,
  onSuccess,
  onClose,
}: {
  label: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>('idle')
  const [fileName, setFileName] = useState('')
  // First attempt always fails in this demo, so a reviewer reliably sees the
  // error state without depending on random luck; second attempt succeeds.
  const attemptRef = useRef(0)

  function handleFile(file: File) {
    setFileName(file.name)
    setStage('uploading')
    attemptRef.current += 1
    const currentAttempt = attemptRef.current
    setTimeout(() => {
      setStage(currentAttempt === 1 ? 'error' : 'success')
    }, 1500)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-semibold text-slate-900 mb-1">Upload {label}</h2>
        <p className="text-sm text-slate-500 mb-4">PDF, JPG, or PNG accepted.</p>

        {stage === 'idle' && (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-8 cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors">
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm text-slate-500">Click to choose a file</span>
            <input type="file" className="hidden" onChange={handleChange} />
          </label>
        )}

        {stage === 'uploading' && (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
            <span className="text-sm text-slate-500">Uploading {fileName}…</span>
          </div>
        )}

        {stage === 'error' && (
          <div>
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2.5 mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Uploaded {label} is unreadable — please upload a clearer copy.</span>
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-4 cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">Try again</span>
              <input type="file" className="hidden" onChange={handleChange} />
            </label>
          </div>
        )}

        {stage === 'success' && (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <CheckCircle2 className="w-8 h-8 text-brand-600" />
            <span className="text-sm font-medium text-slate-900">Upload successful!</span>
            <Button size="sm" className="mt-2" onClick={onSuccess}>
              Continue
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
