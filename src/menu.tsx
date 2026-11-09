// The signed-in person's menu at the end of the bar: who they are, where their
// things are, and the accounts signed in on this browser (@hanzo/app `Others`: each
// other one a press away, Add account, Sign out of this one alone, and of all).
// Another account is chosen and added on this site's own /login, never hanzo.id.

import { Others } from '@hanzo/app/Others'
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { usePick } from '~/pick'
import { LOGIN, remember, useSession } from '~/session'

/** What the menu leads to, besides the accounts. */
const GO = [
  { id: 'my-jobs', label: 'Your jobs', href: '/jobs' },
  { id: 'my-listings', label: 'Your listings', href: '/sell/listings' },
] as const

export function Menu() {
  const session = useSession()
  const go = useNavigate()
  const pick = usePick()
  const name = session.name || 'Signed in'

  // The sign-in that follows comes back to this page.
  const add = () => {
    remember()
    void go(`${LOGIN}?from=add`)
  }

  return (
    <XStack render="section" aria-label="Account" items="center">
      <DropdownMenu placement="bottom-end" offset={8}>
        <DropdownMenuTrigger asChild>
          <XStack render={<button type="button" />} aria-label={`Account: ${name}`} items="center" gap={6} height={34} px={12} rounded={999} borderWidth={0} bg="transparent" hoverStyle={{ bg: '$hover' }} cursor="pointer">
            <Avatar src={null} name={name} alt="" size={22} width={22} height={22} rounded={999} />
            <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1} maxW={120} display="none" $md={{ display: 'flex' }}>
              {name.split(' ')[0]}
            </Text>
          </XStack>
        </DropdownMenuTrigger>
        <DropdownMenuContent minW={240} maxW="calc(100vw - 16px)" aria-label="Account">
          <DropdownMenuLabel>
            <XStack items="center" gap={10} py={4}>
              <Avatar src={null} name={name} alt="" size={36} width={36} height={36} rounded={999} />
              <YStack minW={0} gap={2} flex={1}>
                <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
                  {name}
                </Text>
                {session.email ? (
                  <Text fontSize="$1" color="$soft" numberOfLines={1}>
                    {session.email}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {GO.map((g) => (
            <DropdownMenuItem key={g.id} onSelect={() => void go(g.href)}>
              <Text fontSize="$2" color="$ink">
                {g.label}
              </Text>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Others
            out={session.signOut}
            pick={async (account) => {
              remember()
              if (!(await pick(account))) add()
            }}
            add={add}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </XStack>
  )
}
