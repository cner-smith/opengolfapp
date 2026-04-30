import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmColors = destructive
    ? { bg: '#A33A2A', text: '#F2EEE5' }
    : { bg: '#1F3D2C', text: '#F2EEE5' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(28,33,28,0.55)', padding: 16 }}
      onClick={onCancel}
    >
      <div
        className="bg-caddie-surface w-full"
        style={{
          maxWidth: 420,
          border: '1px solid #9F9580',
          borderRadius: 4,
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kicker" style={{ marginBottom: 8 }}>
          {destructive ? 'Confirm delete' : 'Confirm'}
        </div>
        <div
          className="font-serif text-caddie-ink"
          style={{
            fontSize: 22,
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.25,
            marginBottom: message ? 10 : 22,
          }}
        >
          {title}
        </div>
        {message && (
          <p
            className="text-caddie-ink-dim"
            style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}
          >
            {message}
          </p>
        )}
        <div
          className="flex justify-end"
          style={{ gap: 10 }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-caddie-ink-dim hover:text-caddie-ink disabled:opacity-50"
            style={{
              border: '1px solid #D9D2BF',
              background: 'transparent',
              borderRadius: 2,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              backgroundColor: confirmColors.bg,
              color: confirmColors.text,
              border: 'none',
              borderRadius: 2,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
