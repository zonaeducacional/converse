import { create } from 'zustand';
import { db, MessageRecord, ContactRecord } from './db';
import { xmppClient } from '../services/xmppClient';
import { xml } from '@xmpp/client';

interface ChatState {
  contacts: Record<string, ContactRecord>;
  messages: Record<string, MessageRecord[]>; // keys are bare JIDs
  activeChat: string | null;
  setActiveChat: (jid: string) => void;
  sendMessage: (body: string) => Promise<void>;
  initListeners: () => void;
  loadRoster: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  contacts: {},
  messages: {},
  activeChat: null,

  setActiveChat: (jid) => set({ activeChat: jid }),

  sendMessage: async (body: string) => {
    const { activeChat } = get();
    if (!activeChat) return;

    const messageId = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Cria stanza de mensagem XMPP (XEP-0184 delivery receipts via request node)
    const messageStanza = xml('message', { type: 'chat', to: activeChat, id: messageId },
      xml('body', {}, body),
      xml('request', { xmlns: 'urn:xmpp:receipts' })
    );

    // Salva localmente via Dexie como 'sending'
    const newMsg: MessageRecord = {
      stanzaId: messageId,
      withJid: activeChat,
      from: xmppClient.getClient()?.jid?.bare().toString() || '',
      to: activeChat,
      body,
      timestamp,
      isOwn: true,
      status: 'sending'
    };

    // 1. Atualiza interface INSTANTANEAMENTE (Optimistic UI real)
    set((state) => {
      const chatMessages = state.messages[activeChat] || [];
      return { messages: { ...state.messages, [activeChat]: [...chatMessages, newMsg] } };
    });

    // 2. Salva localmente via Dexie (em background, sem travar UI)
    try {
      await db.messages.add(newMsg);
    } catch (e) {
      console.warn("Aviso: Falha ao salvar no IndexedDB:", e);
    }

    // 3. Envia para o servidor XMPP
    try {
      await xmppClient.send(messageStanza);
      // Atualiza para 'sent' se enviou sem falhas
      db.messages.where({ stanzaId: messageId }).modify({ status: 'sent' }).catch(() => {});
      set((state) => {
        const chatMsgs = (state.messages[activeChat] || []).map(m => m.stanzaId === messageId ? { ...m, status: 'sent' as const } : m);
        return { messages: { ...state.messages, [activeChat]: chatMsgs } };
      });
    } catch (e) {
      console.error("Falha de socket ao enviar mensagem XMPP:", e);
    }
  },

  initListeners: () => {
    // Escutando mensagens que chegam
    const handleIncomingMessage = async (e: Event) => {
      const stanza = (e as CustomEvent).detail;
      const body = stanza.getChildText('body');
      const fromJid = stanza.attrs.from;
      
      if (!body || !fromJid) return;
      
      const bareJid = fromJid.split('/')[0];
      const messageId = stanza.attrs.id || `inc-${Date.now()}`;
      
      const newMsg: MessageRecord = {
        stanzaId: messageId,
        withJid: bareJid,
        from: bareJid,
        to: xmppClient.getClient()?.jid?.bare().toString() || '',
        body,
        timestamp: new Date().toISOString(),
        isOwn: false,
        status: 'read'
      };

      await db.messages.add(newMsg);

      // Adiciona o contato dinamicamente se for o primeiro papo
      set((state) => {
        let contactsObj = { ...state.contacts };
        if (!contactsObj[bareJid]) {
          contactsObj[bareJid] = { jid: bareJid, name: bareJid.split('@')[0], subscription: 'none', unreadCount: 0 };
        }
        if (state.activeChat !== bareJid) {
          contactsObj[bareJid].unreadCount += 1;
        }

        const chatMessages = state.messages[bareJid] || [];
        return { 
          contacts: contactsObj,
          messages: { ...state.messages, [bareJid]: [...chatMessages, newMsg] } 
        };
      });

      // Toca o som ou web push se em background (será chamado pelo PWA worker depois)
    };

    xmppClient.addEventListener('message', handleIncomingMessage);
  },

  loadRoster: async () => {
    try {
      const rosterItems = await xmppClient.fetchRoster();
      const newContacts: Record<string, ContactRecord> = { ...get().contacts };
      
      for (const item of rosterItems) {
        const bareJid = item.jid;
        newContacts[bareJid] = {
          ...newContacts[bareJid],
          jid: bareJid,
          name: item.name,
          subscription: item.subscription,
          unreadCount: newContacts[bareJid]?.unreadCount || 0,
        };
        // Persiste fisicamente no IndexedDB
        await db.contacts.put(newContacts[bareJid]).catch(() => {});
      }
      
      set({ contacts: newContacts });
    } catch (e) {
      console.error('Erro ao processar e salvar Roster:', e);
    }
  }
}));
