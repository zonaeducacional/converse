import { useState, useEffect } from 'react';
import { useXMPP } from './shared/hooks/useXMPP';
import { RosterPanel } from './features/roster/components/RosterPanel';
import { ChatWindow } from './features/chat/components/ChatWindow';
import { useChatStore } from './shared/store/useChatStore';

function App() {
  const { status, error, connect, disconnect } = useXMPP();
  const { contacts, messages, activeChat, setActiveChat, sendMessage, initListeners, loadRoster } = useChatStore();
  const [jid, setJid] = useState('');
  const [password, setPassword] = useState('');

  // Inicia os listeners assim que conecta e busca a lista de contatos (Roster) real
  useEffect(() => {
    if (status === 'online') {
      initListeners();
      loadRoster();
      useChatStore.getState().loadHistory(); // Puxa histórico do servidor (MAM)

      
      // Cria um chat consigo mesmo (Bloco de Notas). No XMPP, enviar para si mesmo funciona como um "Eco" nativo do servidor!
      if (!activeChat) {
        import('./shared/services/xmppClient').then(({ xmppClient }) => {
          const myJid = xmppClient.getClient()?.jid?.bare().toString() || 'eu@xmpp.jp';
          useChatStore.setState((state) => ({
            contacts: {
              ...state.contacts,
              [myJid]: { jid: myJid, name: 'Meu Bloco de Notas (Eu)', subscription: 'both', unreadCount: 0, presence: 'available', statusMessage: 'Mensagens enviadas aqui voltam para você' }
            }
          }));
          setActiveChat(myJid);
        });
      }
    }
  }, [status, activeChat, initListeners, setActiveChat]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jid || !password) return;
    try {
      await connect(jid, password);
    } catch (err) {
      console.error(err);
    }
  };

  if (status === 'offline' || status === 'connecting') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B] p-4">
        <form onSubmit={handleLogin} className="bg-surface dark:bg-surface-dark p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] w-full max-w-sm border border-border flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold font-sans tracking-tight text-brand mb-1">Converse</h1>
            <p className="text-[14px] text-muted font-medium">Acesse sua rede federada</p>
          </div>
          
          {error && <p className="text-red-500 text-[13px] text-center font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-muted ml-1 uppercase tracking-wider">JID (Usuário)</label>
              <input 
                type="email" 
                className="px-4 py-3.5 bg-black/5 dark:bg-white/5 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/30 focus:bg-surface dark:focus:bg-surface-dark transition-all text-[16px] font-sans placeholder:text-muted/60"
                value={jid} onChange={e => setJid(e.target.value)}
                placeholder="ex: voce@xmpp.jp"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-muted ml-1 uppercase tracking-wider">Senha</label>
              <input 
                type="password" 
                className="px-4 py-3.5 bg-black/5 dark:bg-white/5 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/30 focus:bg-surface dark:focus:bg-surface-dark transition-all text-[16px] font-sans placeholder:text-muted/60"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha secreta"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={status === 'connecting'}
            className="mt-2 w-full py-4 bg-brand text-white rounded-2xl font-bold text-[15px] hover:bg-indigo-500 hover:shadow-lg hover:shadow-brand/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none"
          >
            {status === 'connecting' ? 'Autenticando via SASL...' : 'Conectar agora'}
          </button>
          
          <p className="text-[13px] text-center text-muted mt-2">
            Sem conta? Crie grátis em <a href="https://xmpp.jp" target="_blank" rel="noreferrer" className="text-brand font-semibold hover:underline">xmpp.jp</a> ou use <a href="https://jabber.org" target="_blank" rel="noreferrer" className="text-brand font-semibold hover:underline">jabber.org</a>
          </p>
        </form>
      </div>
    );
  }

  // Converte a Store do Zustand para o formato de array que os componentes de UI esperam
  const contactList = Object.values(contacts).map(c => ({
    ...c,
    presence: c.presence || 'unavailable'
  }));
  
  const currentContact = activeChat && contacts[activeChat] 
    ? contacts[activeChat] 
    : { jid: '', name: 'Selecione', presence: 'unavailable' as const, avatar: undefined };
  
  const currentMessages = activeChat && messages[activeChat] ? messages[activeChat].map(m => ({
    id: m.stanzaId,
    content: m.body,
    timestamp: m.timestamp,
    isOwn: m.isOwn,
    status: m.status
  })) : [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F9FAFB] dark:bg-[#09090B]">
      <div className="hidden sm:flex">
        <RosterPanel 
          contacts={contactList} 
          onSelectContact={(jid) => setActiveChat(jid)} 
          selectedJid={activeChat || undefined} 
        />
      </div>
      <div className="flex-1 flex flex-col relative h-full">
        {/* Logout rápido sobreposto no header */}
        <div className="absolute top-4 right-36 z-50">
           <button onClick={disconnect} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-[13px] font-bold hover:bg-red-500/20 transition-colors border border-red-500/10">Desconectar Sessão</button>
        </div>
        
        {activeChat ? (
          <ChatWindow 
            contact={{
              jid: currentContact.jid,
              name: currentContact.name,
              avatar: currentContact.avatar,
              presence: currentContact.presence || 'unavailable'
            }} 
            messages={currentMessages} 
            onSendMessage={sendMessage} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center font-medium text-muted">
            Selecione uma conversa ao lado para começar.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
