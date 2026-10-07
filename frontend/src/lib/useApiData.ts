import { useEffect, useState } from 'react';
import { authFetch } from './auth';

export function useApiData<T>(path: string) {
  const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult({ data: null, loading: true, error: null });
    authFetch(path, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json() as T;
      if (active) setResult({ data, loading: false, error: null });
    }).catch(error => {
      if (active) setResult({ data: null, loading: false, error: error instanceof Error ? error.message : 'Service unavailable' });
    });
    return () => { active = false; controller.abort(); };
  }, [path, revision]);
  return { ...result, reload: () => setRevision(value => value + 1) };
}
