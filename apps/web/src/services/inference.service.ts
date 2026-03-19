import type { InferenceResponse } from '@lpr/shared-types';
import { API_ENDPOINTS } from '../constants';
import apiService from './apiService';

export const inferenceService = {
  async analyzeImage(file: File): Promise<InferenceResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return apiService.post<InferenceResponse, FormData>(API_ENDPOINTS.INFER_IMAGE, formData);
  }
};
