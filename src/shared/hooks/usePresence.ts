import { useState, useEffect, useCallback } from 'react';
import { xmppClient } from '../services/xmppClient';

export type PresenceShow = 'available' | 'away' | 'dnd' | 'unavailable';

export interface PresenceInfo {
  show: PresenceShow;
  status?: string;
}

// Hook polimórfico: se passar targetJid ele escuta apenas 1 usuário,
// se não passar, ele retorna a função para definir a própria presença
export function usePresence(targetJid?: string) {
  // Mapa de presenças locais. Em uma v2 integrariamos diretamente ao Zustand (useRosterStore)
  const [presences, setPresences] = useState<Record<string, PresenceInfo>>({});

  useEffect(() => {
    const handlePresence = (e: Event) => {
      const stanza = (e as CustomEvent).detail;
      const from = stanza.attrs.from;
      if (!from) return;

      const bareJid = from.split('/')[0];
      const type = stanza.attrs.type;
      
      let show: PresenceShow = 'available';
      if (type === 'unavailable') {
        show = 'unavailable';
      } else {
        const showElement = stanza.getChild('show');
        if (showElement) {
          show = showElement.text() as PresenceShow;
        }
      }

      const statusElement = stanza.getChild('status');
      const statusText = statusElement ? statusElement.text() : undefined;

      setPresences((prev) => ({
        ...prev,
        [bareJid]: { show, status: statusText }
      }));
    };

    xmppClient.addEventListener('presence', handlePresence);

    // Cleanup obrigatório
    return () => {
      xmppClient.removeEventListener('presence', handlePresence);
    };
  }, []);

  const setMyPresence = useCallback(async (show: PresenceShow, status?: string) => {
    await xmppClient.sendPresence(show, status);
  }, []);

  if (targetJid) {
    const bareTarget = targetJid.split('/')[0];
    return {
      presence: presences[bareTarget] || { show: 'unavailable' },
      setMyPresence
    };
  }

  return {
    presences,
    setMyPresence
  };
}
