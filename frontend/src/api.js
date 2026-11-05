export const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000')
).replace(/\/$/, '');
const socketBase = new URL(API_URL, window.location.origin);
export const SOCKET_URL = socketBase.origin;
export const SOCKET_PATH = `${socketBase.pathname.replace(/\/$/, '')}/socket.io`;

export async function api(path, options = {}) {
  const token = sessionStorage.getItem('factory_token');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      'We couldn’t connect. Check your connection and try again.',
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !['/login', '/auth/reset-password', '/auth/forgot-password'].includes(
        path,
      )
    ) {
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(
      data.message || data.msg || `Request failed (${response.status}).`,
    );
  }
  return data;
}
