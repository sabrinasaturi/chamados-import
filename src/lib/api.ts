import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000 // Timeout 60s request
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    console.error("[API ERROR]", error?.message, error?.response?.status, error?.config?.url);
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
       console.error("[API TIMEOUT] Request demorou muito!");
    }
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/login' && originalRequest.url !== '/refresh') {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        
        const res = await axios.post('/api/refresh', { token: refreshToken });
        const newToken = res.data.token;
        localStorage.setItem('token', newToken);
        
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-error'));
        return Promise.reject(error); // Return original error on refresh fail
      }
    } else if (error.response?.status === 403 || error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-error'));
    }
    return Promise.reject(error);
  }
);

export default api;
