import { createBrowserRouter } from 'react-router'

import { Callback } from '~/callback'
import { Browse } from '~/pages/browse'
import { Checkout } from '~/pages/checkout'
import { Earnings } from '~/pages/earnings'
import { AppPage, ListingPage, McpPage, SkillPage } from '~/pages/item'
import { JobPage, Jobs } from '~/pages/jobs'
import { ListingForm, Listings } from '~/pages/listings'
import { Setup } from '~/pages/setup'
import { Root } from '~/root'

export const routes = [
  {
    element: <Root />,
    children: [
      { path: '/', element: <Browse /> },
      { path: '/agents', element: <Browse kind="agent" /> },
      { path: '/apps', element: <Browse kind="app" /> },
      { path: '/skills', element: <Browse kind="skill" /> },
      { path: '/mcp', element: <Browse kind="mcp" /> },
      { path: '/auth/callback', element: <Callback /> },
      { path: '/l/:id', element: <ListingPage /> },
      { path: '/apps/:org/:name', element: <AppPage /> },
      { path: '/skills/:name', element: <SkillPage /> },
      { path: '/mcp/:id', element: <McpPage /> },
      { path: '/checkout/:id', element: <Checkout /> },
      { path: '/jobs', element: <Jobs role="buyer" /> },
      { path: '/jobs/:id', element: <JobPage /> },
      { path: '/sell', element: <Setup /> },
      { path: '/sell/listings', element: <Listings /> },
      { path: '/sell/listings/new', element: <ListingForm /> },
      { path: '/sell/listings/:id', element: <ListingForm /> },
      { path: '/sell/jobs', element: <Jobs role="seller" /> },
      { path: '/sell/earnings', element: <Earnings /> },
      { path: '*', element: <Browse /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
