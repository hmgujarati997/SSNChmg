import axios from 'axios';

const API = axios.create({
    baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('ssnc_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('ssnc_token');
            localStorage.removeItem('ssnc_role');
            localStorage.removeItem('ssnc_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
