import axios from "axios";

// 封装 axios 实例，设置默认 baseURL
const api = axios.create({
  baseURL: "http://127.0.0.1:5001/api/v0",
  timeout: 10000, // 10秒超时
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
