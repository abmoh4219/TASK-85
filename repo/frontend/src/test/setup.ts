import '@testing-library/jest-dom';
import axios from 'axios';
import { apiClient } from '../lib/api-client';

// Force Node HTTP adapter (not XHR) so jsdom can hit real backend.
try {
  (axios.defaults as unknown as { adapter: string }).adapter = 'http';
} catch { /* fallback to default */ }

// Point the shared apiClient at the real backend so component tests that use
// useQuery → apiClient hit a real API instead of the unresolvable `/api`.
const backendUrl =
  (typeof process !== 'undefined' && process.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.E2E_API_URL) ||
  'http://localhost:4000';
apiClient.defaults.baseURL = backendUrl;
apiClient.defaults.adapter = 'http';
