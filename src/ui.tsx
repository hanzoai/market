// The parts every screen shares, built on @hanzo/ui's gui primitives and tokens —
// the same system hanzo.ai and the console wear. Monochrome: rank is carried by
// luminance ($ink > $soft > $quiet), never by hue.

import { useState, type ReactNode } from 'react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { Check, Copy } from 'lucide-react'
import { Link } from 'react-router'

import type { Read } from '~/lib/read'

/**
 * The content column, on the same edges as the shell's header and footer:
 * 1216 wide with 32 of gutter, so text lines up with the wordmark above it.
 */
export function Column({ children, gap = '$5', py = '$6' }: { children: ReactNode; gap?: '$4' | '$5' | '$6'; py?: '$6' | '$8' | '$0' }) {
  return (
    <YStack width="100%" maxW={1216} mx="auto" px={32} py={py} gap={gap}>
      {children}
    </YStack>
  )
}

/** A page: its heading, then its content, in the column. */
export function Page({
  eyebrow,
  title,
  says,
  beside,
  children,
}: {
  eyebrow?: string
  title: string
  says?: ReactNode
  beside?: ReactNode
  children: ReactNode
}) {
  return (
    <Column>
      <XStack items="flex-end" gap="$4" flexWrap="wrap">
        <YStack gap="$2" flex={1} minW={260}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Text render="h1" fontSize="$8" fontWeight="600" color="$ink">
            {title}
          </Text>
          {says ? (
            <Text fontSize="$3" color="$soft" maxW={720}>
              {says}
            </Text>
          ) : null}
        </YStack>
        {beside}
      </XStack>
      {children}
    </Column>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="$1" fontWeight="500" color="$quiet" textTransform="uppercase" letterSpacing={1.2}>
      {children}
    </Text>
  )
}

export function Section({ title, says, children }: { title: string; says?: ReactNode; children: ReactNode }) {
  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text render="h2" fontSize="$5" fontWeight="600" color="$ink">
          {title}
        </Text>
        {says ? (
          <Text fontSize="$2" color="$soft">
            {says}
          </Text>
        ) : null}
      </YStack>
      {children}
    </YStack>
  )
}

/** A bordered surface. */
export function Panel({ children, gap = '$3' }: { children: ReactNode; gap?: '$2' | '$3' | '$4' }) {
  return (
    <YStack gap={gap} p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor">
      {children}
    </YStack>
  )
}

/**
 * A button. `loud` is the one white action on a screen; everything else is a
 * hairline. `on` marks the selected one of a set.
 */
export function Act({
  onPress,
  children,
  disabled,
  loud,
  on,
  label,
}: {
  onPress: () => void
  children: ReactNode
  disabled?: boolean
  loud?: boolean
  on?: boolean
  label?: string
}) {
  return (
    <Box
      render="button"
      onClick={disabled ? undefined : onPress}
      aria-disabled={disabled || undefined}
      aria-pressed={on}
      aria-label={label}
      px="$4"
      py="$2"
      rounded="$10"
      borderWidth={1}
      borderColor={loud || on ? '$ink' : '$borderColor'}
      bg={loud ? '$ink' : on ? '$hover' : 'transparent'}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      hoverStyle={disabled ? {} : { bg: loud ? '$ink' : '$hover' }}
    >
      <XStack items="center" justify="center" gap="$2">
        <Text fontSize="$2" color={loud ? '$background' : '$ink'} fontWeight={loud ? '500' : '400'}>
          {children}
        </Text>
      </XStack>
    </Box>
  )
}

/** A link that looks like `Act`. An absolute href leaves the storefront in a new tab. */
export function Go({ to, children, loud }: { to: string; children: ReactNode; loud?: boolean }) {
  const face = (
    <Box
      px="$4"
      py="$2"
      rounded="$10"
      borderWidth={1}
      borderColor={loud ? '$ink' : '$borderColor'}
      bg={loud ? '$ink' : 'transparent'}
      hoverStyle={{ bg: loud ? '$ink' : '$hover' }}
    >
      <Text fontSize="$2" color={loud ? '$background' : '$ink'} fontWeight={loud ? '500' : '400'}>
        {children}
      </Text>
    </Box>
  )
  if (/^https?:\/\//.test(to)) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        {face}
      </a>
    )
  }
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      {face}
    </Link>
  )
}

/** A form control's chrome: the design system's control edge, radius and type. */
const control = {
  background: 'transparent',
  border: '1px solid var(--border-control)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2) var(--space-3)',
  outline: 'none',
  color: 'inherit',
  font: 'inherit',
  fontSize: 'var(--text-base)',
  minWidth: 0,
  width: '100%',
} as const

function Labelled({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1, minWidth: 200 }}>
      <Text fontSize="$2" color="$soft">
        {label}
      </Text>
      {children}
      {help ? (
        <Text fontSize="$1" color="$quiet">
          {help}
        </Text>
      ) : null}
    </label>
  )
}

export function Field({
  label,
  value,
  set,
  hint,
  help,
  type = 'text',
  name,
}: {
  label: string
  value: string
  set: (v: string) => void
  hint?: string
  help?: string
  type?: string
  name?: string
}) {
  return (
    <Labelled label={label} help={help}>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={hint}
        onChange={(e) => set(e.target.value)}
        style={control}
      />
    </Labelled>
  )
}

export function Choice<T extends string>({
  label,
  value,
  set,
  of,
  help,
}: {
  label: string
  value: T
  set: (v: T) => void
  of: readonly { value: T; label: string }[]
  help?: string
}) {
  return (
    <Labelled label={label} help={help}>
      <select value={value} onChange={(e) => set(e.target.value as T)} style={control}>
        {of.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labelled>
  )
}

export function Words({
  label,
  value,
  set,
  hint,
  rows = 4,
}: {
  label: string
  value: string
  set: (v: string) => void
  hint?: string
  rows?: number
}) {
  return (
    <Labelled label={label}>
      <textarea
        value={value}
        placeholder={hint}
        rows={rows}
        onChange={(e) => set(e.target.value)}
        style={{ ...control, resize: 'vertical' }}
      />
    </Labelled>
  )
}

export function Tick({ label, checked, set }: { label: string; checked: boolean; set: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
      <Text fontSize="$2" color="$ink">
        {label}
      </Text>
    </label>
  )
}

/** Fields side by side, wrapping on a phone. */
export function Fields({ children }: { children: ReactNode }) {
  return (
    <XStack gap="$3" flexWrap="wrap">
      {children}
    </XStack>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <XStack items="center" gap="$3" py="$3" flexWrap="wrap" borderBottomWidth={1} borderColor="$borderColor">
      {children}
    </XStack>
  )
}

/** A figure and what it counts. */
export function Count({ of, says }: { of: ReactNode; says: string }) {
  return (
    <YStack gap="$1" p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor" flex={1} minW={160}>
      <Text fontSize="$7" fontWeight="600" color="$ink">
        {of}
      </Text>
      <Text fontSize="$1" color="$soft">
        {says}
      </Text>
    </YStack>
  )
}

export function Nothing({ says }: { says: string }) {
  return (
    <YStack items="center" justify="center" p="$6">
      <Text fontSize="$2" color="$quiet" text="center">
        {says}
      </Text>
    </YStack>
  )
}

/** A refusal from the platform, in its own words. */
export function Failed({ what, why }: { what: string; why: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" role="alert">
      <Text fontSize="$2" color="$ink">
        Could not {what}.
      </Text>
      <Text fontSize="$1" color="$soft">
        {why}
      </Text>
    </YStack>
  )
}

/** An operation api.hanzo.ai does not answer yet: said plainly, never faked. */
export function Pending({ what, says }: { what: string; says: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" data-pending="">
      <XStack items="center" gap="$2">
        <Mark tone="quiet" says="Pending" />
        <Text fontSize="$2" color="$ink">
          {what}
        </Text>
      </XStack>
      <Text fontSize="$1" color="$soft">
        {says}
      </Text>
    </YStack>
  )
}

export function Refusal({ says }: { says: string | null }) {
  return says ? (
    <Text fontSize="$2" color="$ink" fontWeight="500" role="alert">
      {says}
    </Text>
  ) : null
}

/** A read's states: refusal, loading, empty, or its rows. */
export function List<T>({
  read,
  what,
  none,
  children,
}: {
  read: Read<T[]>
  what: string
  none: string
  children: (rows: T[]) => ReactNode
}) {
  if (read.failed) return <Failed what={`load ${what}`} why={read.failed} />
  if (!read.it) return <Nothing says="Loading…" />
  if (!read.it.length) return <Nothing says={none} />
  return <YStack>{children(read.it)}</YStack>
}

export type Tone = 'up' | 'moving' | 'quiet' | 'act'

const ink = { up: '$ink', moving: '$soft', quiet: '$quiet', act: '$ink' } as const

/** A state beside its word. Luminance carries degree: settled is brightest. */
export function Mark({ tone, says }: { tone: Tone; says: string }) {
  const filled = tone !== 'quiet'
  return (
    <XStack items="center" gap="$2">
      <YStack
        width={6}
        height={6}
        rounded={999}
        bg={filled ? ink[tone] : 'transparent'}
        borderWidth={1}
        borderColor={ink[tone]}
      />
      <Text fontSize="$1" color={ink[tone]} fontWeight={tone === 'act' ? '500' : '400'}>
        {says}
      </Text>
    </XStack>
  )
}

/** A line to copy: a CLI command or an MCP call. */
export function Code({ label, line }: { label: string; line: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(line).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <YStack gap="$1">
      <Text fontSize="$1" color="$quiet">
        {label}
      </Text>
      <XStack items="center" gap="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" bg="$hover">
        <Text fontFamily="$mono" fontSize="$2" color="$ink" flex={1} numberOfLines={3} data-code="">
          {line}
        </Text>
        <Box render="button" onClick={copy} aria-label={`Copy ${label}`} p="$1" cursor="pointer">
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        </Box>
      </XStack>
    </YStack>
  )
}

/** A left-to-right sequence of stages. */
export function Stages({ of }: { of: { label: string; stage: 'done' | 'current' | 'todo' | 'failed' }[] }) {
  return (
    <XStack gap="$2" flexWrap="wrap" render="ol" aria-label="Progress">
      {of.map((s) => (
        <XStack
          key={s.label}
          render="li"
          items="center"
          gap="$2"
          px="$3"
          py="$1"
          rounded="$10"
          borderWidth={1}
          borderColor={s.stage === 'current' || s.stage === 'failed' ? '$ink' : '$borderColor'}
          bg={s.stage === 'done' ? '$hover' : 'transparent'}
          data-stage={s.stage}
        >
          <Text fontSize="$1" color={s.stage === 'todo' ? '$quiet' : '$ink'} fontWeight={s.stage === 'current' ? '500' : '400'}>
            {s.label}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}
