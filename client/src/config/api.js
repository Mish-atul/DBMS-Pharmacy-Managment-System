const PROD_API_FALLBACK = 'https://pharmacy-api-jh07.onrender.com';

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : PROD_API_FALLBACK);
