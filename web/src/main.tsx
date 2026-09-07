import { QueryClientProvider } from '@tanstack/solid-query';
import { RouterProvider } from '@tanstack/solid-router';
import { render } from 'solid-js/web';
import 'virtual:uno.css';
import './styles.css';
import { queryClient } from './api';
import { router } from './router';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app element not found');
}

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  ),
  root
);
