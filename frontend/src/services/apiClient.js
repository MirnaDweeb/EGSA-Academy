import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Single-flight silent refresh state
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export class ApiClientError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken() {
  return (
    localStorage.getItem('egsa_access_token') ||
    localStorage.getItem('egsa_token') ||
    localStorage.getItem('esa_token')
  );
}

export function setStoredTokens(accessToken, refreshToken, user) {
  if (accessToken) {
    localStorage.setItem('egsa_access_token', accessToken);
    localStorage.setItem('egsa_token', accessToken);
    localStorage.setItem('esa_token', accessToken);
  }
  if (refreshToken) {
    localStorage.setItem('egsa_refresh_token', refreshToken);
    localStorage.setItem('egsa_refresh', refreshToken);
  }
  if (user) {
    localStorage.setItem('egsa_user', JSON.stringify(user));
    localStorage.setItem('esa_user', JSON.stringify(user));
  }
}

export function clearStoredTokens() {
  localStorage.removeItem('egsa_access_token');
  localStorage.removeItem('egsa_token');
  localStorage.removeItem('esa_token');
  localStorage.removeItem('egsa_refresh_token');
  localStorage.removeItem('egsa_refresh');
  localStorage.removeItem('egsa_user');
  localStorage.removeItem('esa_user');
}

export const tokens = {
  set(access, refresh) {
    setStoredTokens(access, refresh);
  },
  clear() {
    clearStoredTokens();
  },
  getRefresh() {
    return localStorage.getItem('egsa_refresh_token') || localStorage.getItem('egsa_refresh');
  },
  hasAccess() {
    return !!getStoredToken();
  },
};

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url || '';
      const isAuthEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/forgot-password');

      if (isAuthEndpoint) {
        return Promise.reject(normalizeError(error));
      }

      const refreshToken = tokens.getRefresh();
      if (!refreshToken) {
        clearStoredTokens();
        if (!window.location.pathname.startsWith('/login')) {
          window.dispatchEvent(new CustomEvent('egsa_auth_expired'));
        }
        return Promise.reject(normalizeError(error));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const data = response.data?.data || response.data;
        const newAccessToken = data?.accessToken || data?.token;
        const newRefreshToken = data?.refreshToken;

        if (newAccessToken) {
          setStoredTokens(newAccessToken, newRefreshToken);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearStoredTokens();
        window.dispatchEvent(new CustomEvent('egsa_auth_expired'));
        return Promise.reject(normalizeError(refreshErr));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

function normalizeError(error) {
  const status = error.response?.status || 0;
  const data = error.response?.data;
  const message =
    data?.error?.message ||
    data?.message ||
    (status === 0 ? 'Network error or server unreachable' : error.message || 'Unknown error');
  const details = data?.error?.details || data?.errors || null;
  const code = data?.code || data?.error?.code || null;
  return { message, details, status, code, raw: error };
}

export async function refreshSession() {
  const rt = tokens.getRefresh();
  if (!rt) throw new ApiClientError(401, 'no refresh token');
  const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt });
  const data = res.data?.data || res.data;
  setStoredTokens(data.accessToken || data.token, data.refreshToken, data.user);
  return data;
}

export const request = (url, opts = {}) => apiClient(url, opts).then((r) => r.data);

export const get = (url, params) =>
  apiClient.get(url, { params }).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const getWithMeta = (url, params) =>
  apiClient.get(url, { params }).then((r) => r.data);

export const post = (url, body) =>
  apiClient.post(url, body).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const publicPost = (url, body) =>
  apiClient.post(url, body).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const put = (url, body) =>
  apiClient.put(url, body).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const patch = (url, body) =>
  apiClient.patch(url, body).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const del = (url) =>
  apiClient.delete(url).then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export const upload = (url, formData) =>
  apiClient
    .post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => (r.data?.data !== undefined ? r.data.data : r.data));

export default apiClient;
