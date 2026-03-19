import { useState, type SyntheticEvent } from 'react';
import { Box, Typography } from '@mui/material';

type DebugImageProps = {
  src: string;
  alt: string;
};

function DebugImage({ src, alt }: DebugImageProps): JSX.Element {
  const [resolution, setResolution] = useState<string | null>(null);

  return (
    <>
      <Box
        component="img"
        src={src}
        alt={alt}
        onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
          const image = event.currentTarget;
          setResolution(`${image.naturalWidth} x ${image.naturalHeight}`);
        }}
        sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
      />
      {resolution ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {resolution}
        </Typography>
      ) : null}
    </>
  );
}

export default DebugImage;
