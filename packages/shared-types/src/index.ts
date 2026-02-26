export type DetectionResult = {
  plateNumber: string | null;
  province: string | null;
  ocrConf: number;
  provinceConf: number;
  bbox: [number, number, number, number];
};

export type InferenceResponse = {
  requestId: string;
  detections: DetectionResult[];
  message: string;
};
