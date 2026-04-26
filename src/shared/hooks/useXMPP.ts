import { useState, useEffect, useCallback } from 'react';
import { xmppClient, ConnectionStatus } from '../services/xmppClient';

export function useXMPP() {
  const [status, setStatus] = useState<ConnectionStatus>(xmppClient.getStatus());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handlers
    const handleStatus = (e: Event) => {
      setStatus((e as CustomEvent<ConnectionStatus>).detail);
    };
    
    const handleError = (e: Event) => {
      setError((e as CustomEvent<string>).detail);
    };

    // Subscrição
    xmppClient.addEventListener('status', handleStatus);
    xmppClient.addEventListener('error', handleError);

    // Cleanup obrigatório como definido nas regras do prompt
    return () => {
      xmppClient.removeEventListener('status', handleStatus);
      xmppClient.removeEventListener('error', handleError);
    };
  }, []);

  const connect = useCallback(async (jid: string, password: string) => {
    setError(null);
    try {
      await xmppClient.connect(jid, password);
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar no servidor XMPP.');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await xmppClient.disconnect();
  }, []);

  const sendStanza = useCallback(async (stanza: any) => {
    await xmppClient.send(stanza);
  }, []);

  return {
    status,
    error,
    connect,
    disconnect,
    sendStanza,
    client: xmppClient.getClient()
  };
}
