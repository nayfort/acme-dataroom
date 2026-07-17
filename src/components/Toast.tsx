import { X } from 'lucide-react'
import { Button } from './Button'

export interface ToastMessage {
  id: string
  tone: 'success' | 'error' | 'info'
  message: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (toastId: string) => void
}

export function ToastStack({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span>{toast.message}</span>
          <Button
            aria-label="Dismiss notification"
            size="icon"
            title="Dismiss"
            variant="ghost"
            onClick={() => onDismiss(toast.id)}
          >
            <X size={15} />
          </Button>
        </div>
      ))}
    </div>
  )
}
