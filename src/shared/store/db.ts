import Dexie, { Table } from 'dexie';

export interface MessageRecord {
  id?: number;
  stanzaId: string;
  withJid: string; // JID bare do contato da conversa (para agrupar e buscar)
  from: string;
  to: string;
  body: string;
  timestamp: string;
  isOwn: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface ContactRecord {
  jid: string;
  name: string;
  subscription: string;
  avatar?: string;
  unreadCount: number;
  statusMessage?: string;
  presence?: 'available' | 'away' | 'dnd' | 'unavailable';
}

export class XmppDatabase extends Dexie {
  messages!: Table<MessageRecord>;
  contacts!: Table<ContactRecord>;

  constructor() {
    super('MeuXmppDatabase');
    // Índices otimizados para consultas de mensagens e contatos offline
    this.version(1).stores({
      messages: '++id, stanzaId, withJid, timestamp',
      contacts: 'jid, name'
    });
  }
}

export const db = new XmppDatabase();
