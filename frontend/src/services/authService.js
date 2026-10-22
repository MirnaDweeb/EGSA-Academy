import apiClient, { setStoredTokens, clearStoredTokens } from './apiClient.js';

export const authService = {
  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    const payload = res.data?.data || res.data;
    const user = payload.user;
    const token = payload.accessToken || payload.token;
    const refreshToken = payload.refreshToken;

    if (token) {
      setStoredTokens(token, refreshToken, user);
    }
    return { user, token, refreshToken };
  },

  async register(data) {
    const res = await apiClient.post('/auth/register', data);
    const payload = res.data?.data || res.data;
    const user = payload.user;
    return { user, ...payload };
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Continue cleanup even if server call fails
    } finally {
      clearStoredTokens();
    }
  },

  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data?.data || res.data;
  },

  async forgotPassword(email) {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data?.data || res.data;
  },

  async resetPassword(token, password) {
    const res = await apiClient.post('/auth/reset-password', { token, password });
    return res.data?.data || res.data;
  },

  async verifyEmail(token) {
    const res = await apiClient.post('/auth/verify-email', { token });
    return res.data?.data || res.data;
  },
};

export default authService;
