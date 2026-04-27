import React, { useRef, useState, useEffect } from 'react';
import { Box } from '@mui/material';

export const VirtualizedList = ({ items, renderItem, itemHeight, containerHeight }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef();

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <Box
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
      sx={{ height: containerHeight, overflowY: 'auto' }}
    >
      <Box sx={{ position: 'relative', height: items.length * itemHeight }}>
        <Box sx={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
        </Box>
      </Box>
    </Box>
  );
};