import { Box, Button, Paper, Stack, Typography } from '@mui/material';

type UploadPanelProps = {
  isDragging: boolean;
  selectedFileLabel: string;
  previewUrl: string | null;
  onDropFile: (file: File) => void;
  onDragStateChange: (isDragging: boolean) => void;
};

function UploadPanel({
  isDragging,
  selectedFileLabel,
  previewUrl,
  onDropFile,
  onDragStateChange
}: UploadPanelProps): JSX.Element {
  return (
    <Paper
      elevation={0}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDragStateChange(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
          onDropFile(file);
        }
      }}
      sx={{
        border: '2px dashed',
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 5,
        textAlign: 'center',
        backgroundColor: isDragging ? 'rgba(30, 58, 138, 0.05)' : 'white'
      }}
    >
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6">Drag and drop image here</Typography>
        <Typography variant="body2" color="text.secondary">
          JPG, JPEG, PNG, WEBP (max 5MB)
        </Typography>
        <Button variant="outlined" component="label">
          Browse file
          <input
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onDropFile(file);
              }
            }}
          />
        </Button>

        {previewUrl ? (
          <Box sx={{ width: '100%', maxWidth: 480 }}>
            <Box
              component="img"
              src={previewUrl}
              alt="preview"
              sx={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {selectedFileLabel}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {selectedFileLabel}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export default UploadPanel;
