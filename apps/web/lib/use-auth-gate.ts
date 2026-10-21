'use client';
import { useEffect, useState } from 'react';
import { ensureAccessToken } from './api';

// 'loading' until a silent refresh (if a session hint exists) has finished; then 'ready' or 'anon'.
export function useAuthGate(): 'loading' | 'anon' | 'ready' {
  const [state, setState] = useState<'loading' | 'anon' | 'ready'>('loading');
  useEffect(() => {
    let on = true;
    void ensureAccessToken().then((t) => { if (on) setState(t ? 'ready' : 'anon'); });
    return () => { on = false; };
  }, []);
  return state;
}
