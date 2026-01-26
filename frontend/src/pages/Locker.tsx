import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Server,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldCheck,
  LockKeyhole,
} from 'lucide-react'
import { locker, type CredentialHost } from '../lib/api'
import toast from 'react-hot-toast'

type LockerState = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

export default function Locker() {
  const [state, setState] = useState<LockerState>('loading')
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [passwordHosts, setPasswordHosts] = useState<CredentialHost[]>([])
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const { status } = await locker.status()
      setState(status as LockerState)
      if (status === 'unlocked') {
        loadPasswordHosts()
      }
    } catch (err) {
      console.error('Failed to check locker status:', err)
      setState('uninitialized')
    }
  }

  const loadPasswordHosts = async () => {
    try {
      const credentials = await locker.getCredentials()
      setPasswordHosts(credentials)
    } catch (err) {
      console.error('Failed to load credentials:', err)
    }
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (passcode.length < 6) {
      setError('Passcode must be at least 6 characters')
      return
    }

    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }

    setIsSubmitting(true)
    try {
      await locker.setup(passcode)
      toast.success('Secure Locker initialized successfully')
      setState('unlocked')
      loadPasswordHosts()
    } catch (err: any) {
      setError(err.response?.data || 'Failed to setup locker')
    } finally {
      setIsSubmitting(false)
      setPasscode('')
      setConfirmPasscode('')
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!passcode) {
      setError('Please enter your passcode')
      return
    }

    setIsSubmitting(true)
    try {
      await locker.unlock(passcode)
      toast.success('Locker unlocked')
      setState('unlocked')
      loadPasswordHosts()
    } catch (err: any) {
      setError(err.response?.data || 'Incorrect passcode')
    } finally {
      setIsSubmitting(false)
      setPasscode('')
    }
  }

  const handleLock = async () => {
    try {
      await locker.lock()
      setState('locked')
      setPasswordHosts([])
      setRevealedPasswords(new Set())
      toast.success('Locker locked')
    } catch (err) {
      console.error('Failed to lock:', err)
    }
  }

  const togglePasswordVisibility = (hostId: string) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev)
      if (next.has(hostId)) {
        next.delete(hostId)
      } else {
        next.add(hostId)
      }
      return next
    })
  }

  // Mask password for display
  const maskPassword = (password: string) => {
    return '•'.repeat(Math.min(password.length, 16))
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Setup Screen
  if (state === 'uninitialized') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-8 shadow-xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Setup Secure Locker</h1>
            <p className="text-gray-500 dark:text-dark-400 text-sm">
              Create a master passcode to protect your stored credentials. This passcode will be required to view passwords.
            </p>
          </div>

          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Important</p>
                <p className="text-amber-700 dark:text-amber-300/80">
                  Your passcode cannot be recovered if forgotten. All stored credentials are encrypted with XChaCha20-Poly1305 using Argon2id key derivation.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Master Passcode
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter a secure passcode"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Confirm Passcode
              </label>
              <div className="relative">
                <input
                  type={showConfirmPasscode ? 'text' : 'password'}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Confirm your passcode"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPasscode(!showConfirmPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-accent-purple text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Initialize Secure Locker
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // Unlock Screen
  if (state === 'locked') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-8 shadow-xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <LockKeyhole className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unlock Secure Locker</h1>
            <p className="text-gray-500 dark:text-dark-400 text-sm">
              Enter your master passcode to access stored credentials
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Master Passcode
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your passcode"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  Unlock
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // Unlocked - Show Credentials
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary-500" />
            Secure Locker
          </h2>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            View and manage credentials for password-authenticated hosts
          </p>
        </div>
        <button
          onClick={handleLock}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
        >
          <Lock className="w-4 h-4" />
          Lock
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <span className="text-green-700 dark:text-green-400 text-sm font-medium">
          Locker is unlocked. Credentials are accessible.
        </span>
      </div>

      {passwordHosts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center">
            <Key className="w-8 h-8 text-gray-400 dark:text-dark-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Password Credentials</h3>
          <p className="text-gray-500 dark:text-dark-400 max-w-md mx-auto">
            No hosts with password authentication found. Add hosts with password authentication to see them here.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {passwordHosts.map((host, index) => (
              <motion.div
                key={host.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl p-5 hover:border-primary-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-cyan/20 flex items-center justify-center">
                      <Server className="w-6 h-6 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {host.label || host.address}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-dark-400">
                        {host.username}@{host.address}:{host.port}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                        Username
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-dark-900 px-3 py-2 rounded-lg">
                        {host.username}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="flex-1 text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-dark-900 px-3 py-2 rounded-lg">
                          {revealedPasswords.has(host.id)
                            ? (host.password?.startsWith('encrypted:')
                                ? '(encrypted)'
                                : host.password)
                            : maskPassword(host.password || '')}
                        </p>
                        <button
                          onClick={() => togglePasswordVisibility(host.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                          title={revealedPasswords.has(host.id) ? 'Hide password' : 'Show password'}
                        >
                          {revealedPasswords.has(host.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
