import type { AxiosRequestConfig } from 'axios';
import apiClient from './api/axios';

const apiService = {
  async get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
    const response = await apiClient.get<TResponse>(url, config);
    return response.data;
  },

  async post<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await apiClient.post<TResponse>(url, data, config);
    return response.data;
  },

  async patch<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await apiClient.patch<TResponse>(url, data, config);
    return response.data;
  },

  async put<TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await apiClient.put<TResponse>(url, data, config);
    return response.data;
  },

  async delete<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
    const response = await apiClient.delete<TResponse>(url, config);
    return response.data;
  }
};

export default apiService;
