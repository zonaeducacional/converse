import { client, xml } from '@xmpp/client';
import debug from '@xmpp/debug';

export type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

export class XMPPClientService extends EventTarget {
  private static instance: XMPPClientService;
  private xmpp: any = null; // Instância do @xmpp/client
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private status: ConnectionStatus = 'offline';
  
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
  
  public async send(stanza: any) {
    if (!this.xmpp || this.status !== 'online') throw new Error('Cliente XMPP offline.');
    await this.xmpp.send(stanza);
  }
}

export const xmppClient = XMPPClientService.getInstance();
export { xml };
