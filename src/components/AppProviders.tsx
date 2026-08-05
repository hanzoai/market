import { AuthProvider } from '../lib/AuthContext'
import { Identity, Telemetry } from './Analytics'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Telemetry>
      <AuthProvider>
        {/* Binds the signed-in market user to the event stream. Inside
            AuthProvider (it reads the session) and inside Telemetry (it reads
            the client). */}
        <Identity />
        {children}
      </AuthProvider>
    </Telemetry>
  )
}
