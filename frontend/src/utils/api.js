import axios from "axios";
import { getToken } from "./authStorage.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  timeout: 10000, // 10s — fail fast when server is sleeping (Render cold start)
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
