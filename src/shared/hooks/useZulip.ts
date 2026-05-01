import { useState, useEffect, useCallback } from 'react';
import { zulipClient, ZulipStatus, ZulipConfig } from '../services/zulipClient';

export function useZulip() {
  const [status, setStatus] = useState<ZulipStatus>(zulipClient.getStatus());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      setStatus((e as CustomEvent<ZulipStatus>).detail);
    };
    
    const handleError = (e: Event) => {
      setError((e as CustomEvent<string>).detail);
    };

    zulipClient.addEventListener('status', handleStatus);
    zulipClient.addEventListener('error', handleError);

    return () => {
      zulipClient.removeEventListener('status', handleStatus);
      zulipClient.removeEventListener('error', handleError);
    };
  }, []);

  const connect = useCallback(async (config: ZulipConfig) => {
    setError(null);
    try {
      await zulipClient.connect(config);
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar no servidor Zulip.');
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    zulipClient.disconnect();
  }, []);

  return {
    status,
    error,
    connect,
    disconnect,
  };
}
