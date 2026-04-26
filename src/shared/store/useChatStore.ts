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
  loadHistory: (withJid?: string) => Promise<void>;
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
      
      // Verifica se é uma mensagem do MAM (Histórico arquivado XEP-0313)
      const resultNode = stanza.getChild('result', 'urn:xmpp:mam:2');
      let isMam = false;
      let timestamp = new Date().toISOString();
      let msgStanza = stanza;

      if (resultNode) {
        const forwardedNode = resultNode.getChild('forwarded', 'urn:xmpp:forward:0');
        if (forwardedNode) {
          isMam = true;
          const delayNode = forwardedNode.getChild('delay', 'urn:xmpp:delay');
          if (delayNode && delayNode.attrs.stamp) timestamp = delayNode.attrs.stamp;
          
          const fwdMsg = forwardedNode.getChild('message', 'jabber:client') || forwardedNode.getChild('message');
          if (fwdMsg) msgStanza = fwdMsg;
          else return;
        }
      }

      const body = msgStanza.getChildText('body');
      if (!body) return; // Ignora Chat States e acks vazios

      const fromJid = msgStanza.attrs.from;
      const toJid = msgStanza.attrs.to;
      const myBareJid = xmppClient.getClient()?.jid?.bare().toString() || '';
      
      if (!fromJid || !toJid) return;

      const bareFrom = fromJid.split('/')[0];
      const bareTo = toJid.split('/')[0];
      
      const isOwn = bareFrom === myBareJid;
      const withJid = isOwn ? bareTo : bareFrom;
      const messageId = resultNode?.attrs.id || msgStanza.attrs.id || `msg-${Date.now()}`;
      
      const newMsg: MessageRecord = {
        stanzaId: messageId,
        withJid,
        from: bareFrom,
        to: bareTo,
        body,
        timestamp,
        isOwn,
        status: isOwn ? 'read' : 'read'
      };

      // Se a mensagem já existe (evitar duplicar histórico), ignora
      const exists = await db.messages.where({ stanzaId: messageId }).count();
      if (exists > 0) return;

      await db.messages.add(newMsg).catch(() => {});

      set((state) => {
        let contactsObj = { ...state.contacts };
        if (!contactsObj[withJid]) {
          contactsObj[withJid] = { jid: withJid, name: withJid.split('@')[0], subscription: 'none', unreadCount: 0 };
        }
        
        // Não incrementa unread se for histórico do MAM ou mensagem própria
        if (!isOwn && state.activeChat !== withJid && !isMam) {
          contactsObj[withJid].unreadCount += 1;
        }

        const chatMessages = state.messages[withJid] || [];
        const mergedMessages = [...chatMessages, newMsg].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return { 
          contacts: contactsObj,
          messages: { ...state.messages, [withJid]: mergedMessages } 
        };
      });
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
  },

  loadHistory: async (withJid?: string) => {
    await xmppClient.fetchHistory(withJid);
  }
}));
