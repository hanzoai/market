// The signed-in person's menu at the end of the bar: who they are, where their
// things are, and the ways to be someone else or no one. The accounts signed in
// on this browser are hanzo.ai's to list and choose among: Switch account and
// Add account leave for hanzo.ai's sign-in with this site's own request, asking
// it to draw its chooser (`prompt=select_account`), where another account is
// pressed or added, and the code comes back here as that account. This site
// keeps no session of its own to list accounts from.

import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Text, XStack, YStack } from '@hanzo/ui'
import { useNavigate } from 'react-router'

import { remember, useLeave, useSession } from '~/session'

/** What the menu leads to, besides the accounts. */
const GO = [
  { id: 'my-jobs', label: 'Your jobs', href: '/jobs' },
  { id: 'my-listings', label: 'Your listings', href: '/sell/listings' },
] as const

/** The ways to be someone else, both hanzo.ai's chooser: it lists who is signed in there and adds another. */
const ACCOUNTS = [
  { id: 'switch-account', label: 'Switch account' },
  { id: 'add-account', label: 'Add account' },
] as const

export function Menu() {
  const session = useSession()
  const go = useNavigate()
  const leave = useLeave()
  const name = session.name || 'Signed in'

  // The sign-in that follows comes back to this page, as the account chosen there.
  const choose = () => {
    remember()
    void leave('login', 'select_account')
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
          {ACCOUNTS.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={choose}>
              <Text fontSize="$2" color="$ink">
                {a.label}
              </Text>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={session.signOut}>
            <Text fontSize="$2" color="$ink">
              Log out
            </Text>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </XStack>
  )
}
