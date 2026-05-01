import { create } from 'zustand';
import { zulipClient } from '../services/zulipClient';

interface ZulipMessage {
  id: number;
  content: string;
  sender_full_name: string;
  sender_email: string;
  timestamp: number;
  type: 'stream' | 'private';
  display_recipient: string | any[];
  subject?: string;
  sender_id: number;
}

interface ZulipState {
  streams: any[];
  subscriptions: any[];
  topics: Record<number, any[]>;
  messages: Record<string, ZulipMessage[]>;
  activeChat: { type: 'stream' | 'private', to: string, topic?: string, streamId?: number } | null;
  
  setActiveChat: (chat: { type: 'stream' | 'private', to: string, topic?: string, streamId?: number }) => void;
  loadInitialData: () => Promise<void>;
  loadTopics: (streamId: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  initListeners: () => void;
}

let isZulipListenersInitialized = false;

export const useZulipStore = create<ZulipState>((set, get) => ({
  streams: [],
  subscriptions: [],
  topics: {},
  messages: {},
  activeChat: null,

  setActiveChat: (chat) => set({ activeChat: chat }),

  loadInitialData: async () => {
    let [streams, subscriptions] = await Promise.all([
      zulipClient.getStreams(),
      zulipClient.getSubscriptions()
    ]);
    
    if (subscriptions.length === 0 && streams.length > 0) {
      subscriptions = streams.map((s: any) => ({ ...s, name: s.name, stream_id: s.stream_id }));
    }
    
    set({ streams, subscriptions });
  },

  loadTopics: async (streamId: number) => {
    const topics = await zulipClient.getTopics(streamId);
    set((state) => ({
      topics: { ...state.topics, [streamId]: topics }
    }));
  },

  sendMessage: async (content: string) => {
    const { activeChat } = get();
    if (!activeChat) return;

    await zulipClient.sendMessage({
      type: activeChat.type,
      to: activeChat.to,
      topic: activeChat.topic,
      content
    });
  },

  initListeners: () => {
    if (isZulipListenersInitialized) return;
    isZulipListenersInitialized = true;

    zulipClient.addEventListener('message', (e: any) => {
      const msg = e.detail as ZulipMessage;
      set((state) => {
        const key = msg.type === 'stream' 
          ? `${msg.display_recipient}:${msg.subject}` 
          : msg.sender_email;
        
        const existing = state.messages[key] || [];
        // Evita duplicados verificando o ID
        if (existing.some(m => m.id === msg.id)) return state;

        return {
          messages: {
            ...state.messages,
            [key]: [...existing, msg]
          }
        };
      });
    });
  }
}));
