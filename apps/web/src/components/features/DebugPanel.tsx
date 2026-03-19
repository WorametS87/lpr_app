import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { DebugInfo, DetectionResult, PlateDebug } from '@lpr/shared-types';
import { OCR_STRATEGY_LABEL } from '../../constants';
import DebugImage from '../common/DebugImage';
import OcrTracePanel from './OcrTracePanel';

type DebugPanelProps = {
  debugInfo: DebugInfo;
  detections: DetectionResult[];
};

function getOcrChipColor(ocrRegionUsed: string): 'success' | 'warning' | 'error' {
  if (ocrRegionUsed === 'none') {
    return 'error';
  }

  if (ocrRegionUsed.includes('fallback')) {
    return 'warning';
  }

  return 'success';
}

function formatProvinceSourceText(provinceSource: string): string {
  if (provinceSource === 'bottom_ocr') {
    return 'Bottom OCR override';
  }

  if (provinceSource === 'classifier') {
    return 'ResNet18 classifier';
  }

  return 'None (hidden by confidence rules)';
}

function renderPipelineStages(plate: PlateDebug): JSX.Element {
  const stages = [
    { label: '1. Raw crop', image: plate.plateCrop },
    { label: '2. Dewarped', image: plate.plateCropDewarped },
    { label: '3. Top 70% (number)', image: plate.plateCropTop70 },
    { label: '4. CLAHE + sharpen', image: plate.plateCropPreprocessed },
    { label: '5. Bottom 30% (province)', image: plate.plateCropBottom }
  ];

  return (
    <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
      {stages.map((stage) => {
        if (!stage.image) {
          return null;
        }

        return (
          <Box key={stage.label} flex="1 1 40%" minWidth={0}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              {stage.label}
            </Typography>
            <DebugImage src={stage.image} alt={stage.label} />
          </Box>
        );
      })}
    </Stack>
  );
}

function DebugPanel({ debugInfo, detections }: DebugPanelProps): JSX.Element {
  const { timings, annotatedImage, plates } = debugInfo;
  const plateByDetectionIndex = new Map(
    plates.map((plate, index) => [plate.detectionIndex ?? index, plate] as const)
  );
  const hasDebugCrops = Boolean(annotatedImage) || plates.length > 0;

  return (
    <Box mt={2}>
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight={600}>
            Debug Info
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                display="block"
                mb={0.5}
              >
                TIMINGS
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`Resize: ${timings.resize_ms} ms`} />
                <Chip size="small" label={`Inference: ${timings.inference_ms} ms`} color="primary" />
                <Chip size="small" label={`Total: ${timings.total_ms} ms`} color="secondary" />
              </Stack>
            </Box>

            <Divider />

            {hasDebugCrops ? (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  display="block"
                  mb={0.5}
                >
                  ANNOTATED FRAME
                </Typography>
                {annotatedImage ? (
                  <DebugImage src={annotatedImage} alt="annotated" />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No annotated frame returned.
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                Detailed debug images are disabled on model server. Start model with
                <strong> LPR_DEBUG_MODE=1</strong>.
              </Alert>
            )}

            {detections.map((detection, detectionIndex) => {
              const plate = plateByDetectionIndex.get(detectionIndex);
              const plateSource = plate?.ocrRegionUsed ?? detection.plateSource ?? 'none';
              const provinceSource = plate?.provinceSource ?? detection.provinceSource ?? 'none';

              return (
                <Box key={`det-${detectionIndex}`}>
                  <Divider />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                    display="block"
                    mt={1}
                    mb={1}
                  >
                    DETECTION {detectionIndex + 1} - FINAL OUTPUT
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>Plate number</TableCell>
                        <TableCell>{detection.plateNumber ?? '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province</TableCell>
                        <TableCell>{detection.province ?? '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Plate source</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={plateSource}
                            variant="outlined"
                            color={getOcrChipColor(plateSource)}
                          />
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                            {OCR_STRATEGY_LABEL[plateSource] ?? plateSource}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province source</TableCell>
                        <TableCell>{formatProvinceSourceText(provinceSource)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>OCR confidence</TableCell>
                        <TableCell>{(detection.ocrConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province confidence</TableCell>
                        <TableCell>{(detection.provinceConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {!plate ? (
                    <Alert severity="info" sx={{ mb: 1 }}>
                      Detailed per-stage debug for this detection was not returned by model.
                    </Alert>
                  ) : null}

                  {plate ? (
                    <>
                  <Divider />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                    display="block"
                    mt={1}
                    mb={1}
                  >
                    DETECTION {detectionIndex + 1} - FULL PROCESS
                  </Typography>

                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 1 - YOLOX Detection
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>
                          Detection confidence
                        </TableCell>
                        <TableCell>{(plate.detectionConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Red plate</TableCell>
                        <TableCell>{plate.isRedPlate ? 'Yes - province classification skipped' : 'No'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 2 - Preprocessing Pipeline (5 stages)
                  </Typography>
                  {renderPipelineStages(plate)}

                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 3 - OCR (Plate Number)
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>Strategy used</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={plate.ocrRegionUsed}
                            variant="outlined"
                            color={getOcrChipColor(plate.ocrRegionUsed)}
                          />
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                            {OCR_STRATEGY_LABEL[plate.ocrRegionUsed] ?? plate.ocrRegionUsed}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {(plate.ocrRawTokens ?? []).length > 0 && (
                    <Box mb={1}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Raw OCR tokens from top 70%:
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          {(plate.ocrRawTokens ?? []).map((token, tokenIndex) => (
                            <TableRow key={tokenIndex}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{token.text}</TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>
                                {(token.conf * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                  <OcrTracePanel plate={plate} />

                  {!plate.isRedPlate && (
                    <>
                      <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                        Step 4 - Province Detection
                      </Typography>
                      <Table size="small" sx={{ mb: 1 }}>
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ color: 'text.secondary', width: 180 }}>Source</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={
                                  plate.provinceSource === 'bottom_ocr'
                                    ? 'Bottom OCR (overrode classifier)'
                                    : 'ResNet18 classifier'
                                }
                                color={plate.provinceSource === 'bottom_ocr' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                          {plate.bottomOcrProvince && (
                            <TableRow>
                              <TableCell sx={{ color: 'text.secondary' }}>Bottom OCR read</TableCell>
                              <TableCell>
                                {plate.bottomOcrProvince}
                                <Typography variant="caption" color="text.secondary" ml={1}>
                                  ({(plate.bottomOcrScore * 100).toFixed(1)}% match)
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </>
                  )}
                    </>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

export default DebugPanel;
