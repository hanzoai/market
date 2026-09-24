import { ThemeProvider } from 'next-themes'
import { RouterProvider } from 'react-router/dom'

import { router } from '~/routes'

export const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <RouterProvider router={router} />
  </ThemeProvider>
)
