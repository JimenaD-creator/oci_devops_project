import { useState, useEffect } from 'react';

const cache = new Map();

export function useCache(key, fetchFn, dependencies = [], ttl = 60000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const cached = cache.get(key);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < ttl) {
        setData(cached.data);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const result = await fetchFn();
        cache.set(key, { data: result, timestamp: now });
        setData(result);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, dependencies);
  
  const invalidateCache = () => {
    cache.delete(key);
  };
  
  return { data, loading, error, invalidateCache };
}