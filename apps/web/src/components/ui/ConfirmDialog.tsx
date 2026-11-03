import { useEffect, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  /** Shown in brick under the message; the dialog stays open on failure. */
  error?: string | null
  /** Extra content under the message (Delete account's type-to-confirm field). */
  children?: ReactNode
  confirmDisabled?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  /** Escape and the scrim; defaults to onCancel. For a cancel key that goes somewhere. */
  onDismiss?: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  error,
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  onDismiss = onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(28,33,28,0.55)', padding: 16 }}
      onClick={onDismiss}
    >
      <div
        className="paper-tile w-full"
        style={{ maxWidth: 420, padding: 22, boxShadow: '3px 3px 0 rgba(28,33,28,0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
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
        {children}
        {error && (
          <p role="alert" className="text-caddie-neg" style={{ fontSize: 13, lineHeight: 1.45, margin: '-10px 0 18px' }}>
            {error}
          </p>
        )}
        <div
          className="flex justify-end"
          style={{ gap: 10, paddingBottom: 3 }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="key"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={destructive ? 'key key-danger' : 'key key-primary'}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
