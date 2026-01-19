import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import './VerificationCode.css'

interface VerificationCodeProps {
  email: string
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>
  onResend: () => Promise<{ success: boolean; error?: string }>
  onBack: () => void
  isDarkTheme?: boolean
}

export function VerificationCode({
  email,
  onVerify,
  onResend,
  onBack,
  isDarkTheme = false,
}: VerificationCodeProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('')
    const newCode = [...code]
    digits.forEach((digit, i) => {
      newCode[i] = digit
    })
    setCode(newCode)
    inputRefs.current[Math.min(digits.length, 5)]?.focus()
  }

  const handleSubmit = async () => {
    const verificationCode = code.join('')
    if (verificationCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter all 6 digits' })
      return
    }

    setIsVerifying(true)
    setMessage(null)

    const result = await onVerify(verificationCode)

    setIsVerifying(false)

    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Verification failed' })
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return

    const result = await onResend()

    if (result.success) {
      setMessage({ type: 'success', text: 'Verification code sent!' })
      setResendCooldown(60)

      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to resend code' })
    }
  }

  return (
    <div className={`verification-code-container ${isDarkTheme ? 'dark' : ''}`}>
      <div className={`verification-code-card ${isDarkTheme ? 'dark' : ''}`}>
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>

        <h2>Verify Your Email</h2>
        <p className="instruction">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>

        <div className="code-inputs">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="code-input"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <button
          className="verify-button"
          onClick={handleSubmit}
          disabled={isVerifying || code.join('').length !== 6}
        >
          {isVerifying ? 'Verifying...' : 'Verify Email'}
        </button>

        <button
          className="resend-button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0
            ? `Resend code (${resendCooldown}s)`
            : 'Resend code'}
        </button>
      </div>
    </div>
  )
}
