import { client, xml } from '@xmpp/client';
import debug from '@xmpp/debug';

export type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

export class XMPPClientService extends EventTarget {
  private static instance: XMPPClientService;
  private xmpp: any = null; // Instância do @xmpp/client
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private status: ConnectionStatus = 'offline';
  private hasConnectedBefore = false;
  
  private constructor() {
    super();
  }

  public static getInstance(): XMPPClientService {
    if (!XMPPClientService.instance) {
      XMPPClientService.instance = new XMPPClientService();
    }
    return XMPPClientService.instance;
  }

  public getStatus() {
    return this.status;
  }
  
  public getClient() {
    return this.xmpp;
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.dispatchEvent(new CustomEvent('status', { detail: newStatus }));
  }

  public connect(jid: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus('connecting');
      
      const domain = import.meta.env.VITE_XMPP_DOMAIN || jid.split('@')[1];
      const wsUrl = import.meta.env.VITE_XMPP_WS_URL;
      const boshUrl = import.meta.env.VITE_XMPP_BOSH_URL;
      
      // Prioridade: WebSocket > BOSH > Padrão 5281
      const service = wsUrl || boshUrl || `wss://${domain}:5281/xmpp-websocket`;

      this.xmpp = client({
        service,
        domain,
        username: jid.split('@')[0],
        password,
      });

      // Habilitar logs detalhados apenas em modo de desenvolvimento
      if (import.meta.env.DEV) {
        debug(this.xmpp, true);
      }

      this.xmpp.on('online', async (address: any) => {
        if (import.meta.env.DEV) console.log('XMPP Online como', address.toString());
        this.reconnectAttempts = 0;
        this.hasConnectedBefore = true;
        this.setStatus('online');
        
        // RFC 6121: Enviar presença inicial (available) no login
        await this.sendPresence('available');
        resolve();
      });

      this.xmpp.on('offline', () => {
        if (import.meta.env.DEV) console.log('XMPP Offline');
        if (this.status !== 'reconnecting') {
          this.setStatus('offline');
        }
      });

      this.xmpp.on('error', (err: any) => {
        if (import.meta.env.DEV) console.error('Erro XMPP:', err);
        this.handleReconnect(jid, password);
        reject(err);
      });

      // Tratamento genérico de Stanzas
      this.xmpp.on('stanza', (stanza: any) => {
        if (stanza.is('presence')) {
          this.dispatchEvent(new CustomEvent('presence', { detail: stanza }));
        } else if (stanza.is('message')) {
          this.dispatchEvent(new CustomEvent('message', { detail: stanza }));
        } else if (stanza.is('iq')) {
          this.dispatchEvent(new CustomEvent('iq', { detail: stanza }));
        }
      });

      this.xmpp.start().catch((err: any) => {
        this.handleReconnect(jid, password);
        reject(err);
      });
    });
  }

  private handleReconnect(jid: string, password: string) {
    if (!this.hasConnectedBefore) {
      this.setStatus('offline');
      return; // Se o primeiro login falhou, não tenta auto-reconectar no fundo
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('offline');
      this.dispatchEvent(new CustomEvent('error', { detail: 'Máximo de tentativas de reconexão atingido.' }));
      return;
    }

    this.reconnectAttempts++;
    this.setStatus('reconnecting');
    
    // Backoff exponencial: 2s, 4s, 8s, 16s, 32s
    const backoffTime = Math.pow(2, this.reconnectAttempts) * 1000;
    
    if (import.meta.env.DEV) {
      console.log(`Reconectando em ${backoffTime}ms (Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }

    setTimeout(() => {
      this.connect(jid, password).catch(() => {});
    }, backoffTime);
  }

  public async disconnect() {
    if (!this.xmpp) return;
    
    // Encerrar stanza de presença indisponível de forma limpa antes de fechar a conexão
    await this.sendPresence('unavailable');
    
    await this.xmpp.stop();
    this.xmpp = null;
    this.hasConnectedBefore = false;
    this.setStatus('offline');
  }

  public async sendPresence(show: 'available' | 'away' | 'dnd' | 'unavailable', statusText?: string) {
    if (!this.xmpp || this.status !== 'online') return;

    let presence;
    if (show === 'unavailable') {
      presence = xml('presence', { type: 'unavailable' });
    } else {
      presence = xml('presence', {}, 
        show !== 'available' ? xml('show', {}, show) : null,
        statusText ? xml('status', {}, statusText) : null
      );
    }

    await this.xmpp.send(presence);
  }

  public async addContact(jid: string) {
    if (!this.xmpp || this.status !== 'online') return;
    // Envia requisição de assinatura para poder ver o status online do contato
    const presence = xml('presence', { to: jid, type: 'subscribe' });
    await this.xmpp.send(presence);
  }

  public async acceptContact(jid: string) {
    if (!this.xmpp || this.status !== 'online') return;
    // Aceita o pedido de assinatura recebido
    const presenceSubscribed = xml('presence', { to: jid, type: 'subscribed' });
    await this.xmpp.send(presenceSubscribed);
    // Para termos contato bidirecional, enviamos um pedido de volta
    const presenceSubscribe = xml('presence', { to: jid, type: 'subscribe' });
    await this.xmpp.send(presenceSubscribe);
  }

  public async fetchRoster(): Promise<any[]> {
    if (!this.xmpp || this.status !== 'online') throw new Error('Cliente XMPP offline.');
    
    // Requisição IQ do tipo 'get' para o namespace jabber:iq:roster
    const iq = xml('iq', { type: 'get' },
      xml('query', { xmlns: 'jabber:iq:roster' })
    );
    
    try {
      const response = await this.xmpp.sendReceive(iq);
      const query = response.getChild('query', 'jabber:iq:roster');
      if (!query) return [];
      
      const items = query.getChildren('item');
      return items.map((item: any) => ({
        jid: item.attrs.jid,
        name: item.attrs.name || item.attrs.jid.split('@')[0],
        subscription: item.attrs.subscription || 'none',
      }));
    } catch (e) {
      console.error('Falha ao buscar lista de contatos (Roster):', e);
      return [];
    }
  }

  public async fetchVCard(jid?: string): Promise<{ avatarBase64?: string, statusText?: string, fullName?: string } | null> {
    if (!this.xmpp || this.status !== 'online') return null;
    const iq = xml('iq', { type: 'get', ...(jid ? { to: jid } : {}) },
      xml('vCard', { xmlns: 'vcard-temp' })
    );
    try {
      const res = await this.xmpp.sendReceive(iq);
      const vCard = res.getChild('vCard', 'vcard-temp');
      if (!vCard) return null;
      
      const photo = vCard.getChild('PHOTO');
      let avatarBase64;
      if (photo) {
        const binval = photo.getChildText('BINVAL');
        const type = photo.getChildText('TYPE') || 'image/jpeg';
        if (binval) avatarBase64 = `data:${type};base64,${binval.replace(/\s/g, '')}`;
      }
      
      const fullName = vCard.getChildText('FN');
      const desc = vCard.getChildText('DESC');
      
      return { avatarBase64, fullName, statusText: desc };
    } catch (e) {
      console.warn('vCard não suportado ou não existe para', jid);
      return null;
    }
  }

  public async publishVCard(data: { avatarBase64?: string, fullName?: string, statusText?: string }) {
    if (!this.xmpp || this.status !== 'online') return;
    
    const vCardContent = [];
    if (data.fullName) vCardContent.push(xml('FN', {}, data.fullName));
    if (data.statusText) vCardContent.push(xml('DESC', {}, data.statusText));
    
    if (data.avatarBase64) {
      const match = data.avatarBase64.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/);
      if (match) {
        vCardContent.push(
          xml('PHOTO', {},
            xml('TYPE', {}, match[1]),
            xml('BINVAL', {}, match[2])
          )
        );
      }
    }

    const iq = xml('iq', { type: 'set' },
      xml('vCard', { xmlns: 'vcard-temp' }, ...vCardContent)
    );
    await this.xmpp.sendReceive(iq);
  }

  public async fetchHistory(withJid?: string): Promise<void> {
    if (!this.xmpp || this.status !== 'online') return;

    const iqId = `mam-${Date.now()}`;
    const queryNode = xml('query', { xmlns: 'urn:xmpp:mam:2', queryid: iqId });
    
    // Filtrar o histórico por um contato específico (Opcional, senão puxa os últimos globais)
    if (withJid) {
       queryNode.append(
         xml('x', { xmlns: 'jabber:x:data', type: 'submit' },
           xml('field', { var: 'FORM_TYPE', type: 'hidden' }, xml('value', {}, 'urn:xmpp:mam:2')),
           xml('field', { var: 'with' }, xml('value', {}, withJid))
         )
       );
    }

    // Paginação RSM (Result Set Management) - Pega os últimos 50
    queryNode.append(
       xml('set', { xmlns: 'http://jabber.org/protocol/rsm' }, 
         xml('max', {}, '50'),
         xml('before')
       )
    );

    const iq = xml('iq', { type: 'set', id: iqId }, queryNode);
    
    try {
      // Envia o pedido de arquivo. As mensagens virão via evento "message" como "forwarded"
      await this.xmpp.sendReceive(iq);
    } catch (e) {
      console.error('Aviso MAM (Histórico pode não ser suportado pelo server):', e);
    }
  }
  
  public async send(stanza: any) {
    if (!this.xmpp || this.status !== 'online') throw new Error('Cliente XMPP offline.');
    await this.xmpp.send(stanza);
  }
}

export const xmppClient = XMPPClientService.getInstance();
export { xml };
