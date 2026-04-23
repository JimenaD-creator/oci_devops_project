import React, { useState, useEffect } from 'react';
import { Skeleton } from '@mui/material';

export const OptimizedImage = ({ src, alt, width, height, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
  }, [src]);

  if (error) return null;
  if (!loaded) return <Skeleton variant="rectangular" width={width} height={height} />;

  return <img src={src} alt={alt} width={width} height={height} style={style} loading="lazy" />;
};
