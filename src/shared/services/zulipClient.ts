export type ZulipStatus = 'offline' | 'connecting' | 'online' | 'error';

export interface ZulipConfig {
  username: string;
  apiKey: string;
  realm: string;
}

export class ZulipClientService extends EventTarget {
  private static instance: ZulipClientService;
  private config: ZulipConfig | null = null;
  private status: ZulipStatus = 'offline';
  private eventQueueId: string | null = null;
  private lastEventId: number = -1;
  private isPolling: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): ZulipClientService {
    if (!ZulipClientService.instance) {
      ZulipClientService.instance = new ZulipClientService();
    }
    return ZulipClientService.instance;
  }

  public getStatus() {
    return this.status;
  }

  private setStatus(newStatus: ZulipStatus) {
    this.status = newStatus;
    this.dispatchEvent(new CustomEvent('status', { detail: newStatus }));
  }

  private getAuthHeader() {
    if (!this.config) return {};
    const auth = btoa(`${this.config.username}:${this.config.apiKey}`);
    return {
      'Authorization': `Basic ${auth}`
    };
  }

  public async connect(config: ZulipConfig): Promise<void> {
    this.setStatus('connecting');
    this.config = config;
    try {
      // Normaliza o realm URL
      if (this.config.realm.endsWith('/')) {
        this.config.realm = this.config.realm.slice(0, -1);
      }

      const response = await fetch(`${this.config.realm}/api/v1/users/me`, {
        headers: this.getAuthHeader()
      });

      const data = await response.json();
      if (data.result !== 'success') {
        throw new Error(data.msg || 'Falha na autenticação Zulip');
      }

      this.setStatus('online');
      this.startPolling();
      
      localStorage.setItem('zulip_config', JSON.stringify(config));
    } catch (error: any) {
      this.setStatus('error');
      console.error('Zulip connection error:', error);
      throw error;
    }
  }

  public disconnect() {
    this.isPolling = false;
    this.config = null;
    this.eventQueueId = null;
    this.setStatus('offline');
    localStorage.removeItem('zulip_config');
  }

  private async startPolling() {
    if (this.isPolling || !this.config) return;
    this.isPolling = true;

    try {
      const regResponse = await fetch(`${this.config.realm}/api/v1/register`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          event_types: JSON.stringify(['message', 'presence', 'typing', 'update_message_flags'])
        })
      });

      const registration = await regResponse.json();
      this.eventQueueId = registration.queue_id;
      this.lastEventId = registration.last_event_id;

      while (this.isPolling && this.status === 'online' && this.config) {
        const pollUrl = new URL(`${this.config.realm}/api/v1/events`);
        pollUrl.searchParams.set('queue_id', this.eventQueueId!);
        pollUrl.searchParams.set('last_event_id', this.lastEventId.toString());
        pollUrl.searchParams.set('dont_block', 'false');

        const response = await fetch(pollUrl.toString(), {
          headers: this.getAuthHeader()
        });

        const data = await response.json();
        if (data.result === 'success') {
          for (const event of data.events) {
            this.lastEventId = Math.max(this.lastEventId, event.id);
            this.handleEvent(event);
          }
        } else if (data.code === 'BAD_EVENT_QUEUE_ID') {
          this.isPolling = false;
          this.startPolling();
          break;
        }
      }
    } catch (error) {
      console.error('Zulip polling error:', error);
      this.isPolling = false;
      if (this.status === 'online') {
        setTimeout(() => this.startPolling(), 5000);
      }
    }
  }

  private handleEvent(event: any) {
    this.dispatchEvent(new CustomEvent('event', { detail: event }));
    if (event.type === 'message') {
      this.dispatchEvent(new CustomEvent('message', { detail: event.message }));
    }
  }

  public async sendMessage(params: { type: 'stream' | 'private', to: string | number[], topic?: string, content: string }) {
    if (!this.config) throw new Error('Zulip not connected');
    
    const body: any = {
      type: params.type,
      to: typeof params.to === 'string' ? params.to : JSON.stringify(params.to),
      content: params.content
    };
    if (params.topic) body.topic = params.topic;

    const response = await fetch(`${this.config.realm}/api/v1/messages`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(body)
    });
    return await response.json();
  }

  public async getTopics(streamId: number) {
    if (!this.config) return [];
    try {
      const response = await fetch(`${this.config.realm}/api/v1/users/me/${streamId}/topics`, {
        headers: this.getAuthHeader()
      });
      const data = await response.json();
      return data.topics || [];
    } catch (e) {
      return [];
    }
  }

  public async register(email: string, fullName: string): Promise<void> {
    const adminEmail = 'zonaeducacional@gmail.com'; 
    const adminKey = 'uxKJWa29G8k6OBVa4tP95Cmtp2gGjcWb';
    const realm = 'https://zonaeducacional.zulipchat.com';

    const auth = btoa(`${adminEmail}:${adminKey}`);
    
    const response = await fetch(`${realm}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        email: email,
        password: 'SenhaPadrao123!', 
        full_name: fullName
      })
    });

    const data = await response.json();
    if (data.result !== 'success') {
      throw new Error(data.msg || 'Falha ao criar conta no Zulip');
    }
  }

  public async getStreams() {
    if (!this.config) return [];
    try {
      const response = await fetch(`${this.config.realm}/api/v1/streams`, {
        headers: this.getAuthHeader()
      });
      const data = await response.json();
      return data.streams || [];
    } catch (e) {
      return [];
    }
  }

  public async getSubscriptions() {
    if (!this.config) return [];
    try {
      const response = await fetch(`${this.config.realm}/api/v1/users/me/subscriptions`, {
        headers: this.getAuthHeader()
      });
      const data = await response.json();
      return data.subscriptions || [];
    } catch (e) {
      return [];
    }
  }
}

export const zulipClient = ZulipClientService.getInstance();
