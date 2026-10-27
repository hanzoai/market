// A path the app does not route: says so, and points at every shelf.

import { Text, XStack } from '@hanzo/ui'

import { LABEL, PATH } from '~/lib/catalog'
import { KINDS } from '~/lib/market'
import { Column, Eyebrow, Go } from '~/ui'

export function Missing() {
  return (
    <Column gap="$4" py="$8">
      <Eyebrow>Not found</Eyebrow>
      <Text render="h1" fontSize="$8" fontWeight="600" color="$ink">
        No page at this address
      </Text>
      <Text fontSize="$3" color="$soft">
        It may have left the catalog. Every listing is on its shelf.
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        <Go to="/">Hanzo Market</Go>
        {KINDS.map((k) => (
          <Go key={k} to={PATH[k]}>
            {LABEL[k].many}
          </Go>
        ))}
      </XStack>
    </Column>
  )
}
