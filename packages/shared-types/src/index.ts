export type DetectionResult = {
  plateNumber: string | null;
  province: string | null;
  ocrConf: number;
  provinceConf: number;
  plateSource?: string;
  provinceSource?: string;
  bbox: [number, number, number, number];
};

export type OcrToken = {
  text: string;
  conf: number;
};

export type TraceValue = string | number | boolean | null;

export type TraceRecord = {
  [key: string]: TraceValue | TraceRecord | TraceRecord[] | TraceValue[];
};

export type OcrTraceStep = {
  stage: string;
  ocrTokens?: OcrToken[];
  ocr_tokens?: OcrToken[];
  candidates?: TraceRecord[];
  expanded?: TraceRecord[];
  pickResult?: TraceRecord | null;
  pick_result?: TraceRecord | null;
  isSoft?: boolean;
  is_soft?: boolean;
  earlyExit?: boolean;
  early_exit?: boolean;
  imageB64?: string | null;
  image_b64?: string | null;
  note?: string;
};

export type PlateDebug = {
  detectionIndex: number;
  plateCrop: string;              // stage 1: raw bbox crop from YOLOX
  plateCropDewarped: string;      // stage 2: after perspective dewarp
  plateCropTop70: string;         // stage 3: top 70% of dewarped (OCR number region)
  plateCropPreprocessed: string;  // stage 4: after CLAHE + unsharp mask (final OCR input)
  plateCropInner: string;         // stage 5: province input crop (kept for debug payload)
  plateCropBottom: string;        // stage 6: bottom 30% of inner (province strip)
  ocrRegionUsed: string;          // top70 / full / top70_retry / full_retry / none / ...
  isRedPlate: boolean;
  ocrRawTokens: OcrToken[];
  detectionConf: number;
  provinceSource: string;         // "classifier" or "bottom_ocr"
  bottomOcrProvince: string | null;
  bottomOcrScore: number;
  ocrTrace?: OcrTraceStep[];
  ocr_trace?: OcrTraceStep[];
};

export type DebugInfo = {
  annotatedImage: string;           // base64 JPEG data-URI of full frame with bboxes
  plates: PlateDebug[];
  timings: {
    resize_ms: number;
    inference_ms: number;
    total_ms: number;
  };
};

export type InferenceResponse = {
  requestId: string;
  detections: DetectionResult[];
  message: string;
  debugInfo: DebugInfo;
};
