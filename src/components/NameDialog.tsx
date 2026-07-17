import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface NameDialogProps {
  title: string
  label: string
  initialValue?: string
  confirmLabel: string
  onClose: () => void
  onSubmit: (value: string) => string | void
}

export function NameDialog({
  title,
  label,
  initialValue = '',
  confirmLabel,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      setError('Name is required.')
      return
    }

    const result = onSubmit(trimmedValue)
    if (result) {
      setError(result)
      return
    }

    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          <span>{label}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
          />
        </label>
        {error ? <p className="form__error">{error}</p> : null}
        <footer className="dialog-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {confirmLabel}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
