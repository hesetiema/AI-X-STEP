import { useEffect, useRef, useState } from 'react';
import { getDiagnosis } from '@/shared/api/diagnosis-client';
import type { DiagnosisResult } from '@/shared/types';

type Status = 'loading' | 'done' | 'error';

const POLL_INTERVAL = 1200;
const TERMINAL_STATES = new Set(['completed', 'failed']);

export function useDiagnosisResult(taskId: string | null) {
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taskId) {
      setStatus('error');
      setError('缺少 taskId 参数');
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getDiagnosis(taskId);
        if (cancelled) return;
        setResult(res);
        if (TERMINAL_STATES.has(res.status)) {
          setStatus('done');
          return;
        }
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [taskId]);

  return { result, status, error };
}
