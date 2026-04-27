import React, { useState, useMemo } from 'react';
import { Search, UserPlus, LogOut, User } from 'lucide-react';
import { PresenceShow } from '../../../shared/hooks/usePresence';
import { useChatStore } from '../../../shared/store/useChatStore';
import { ProfileModal } from '../../profile/components/ProfileModal';

export interface RosterContact {
  jid: string;
  name: string;
  avatar?: string;
  presence: PresenceShow;
  statusMessage?: string;
  unreadCount?: number;
}

interface RosterPanelProps {
  contacts: RosterContact[];
  onSelectContact: (jid: string) => void;
  selectedJid?: string;
  onLogout?: () => void;
}

const presenceColors: Record<PresenceShow, string> = {
  available: 'bg-online',
  away: 'bg-away',
  dnd: 'bg-dnd',
  unavailable: 'bg-unavail',
};

export const RosterPanel: React.FC<RosterPanelProps> = ({ contacts, onSelectContact, selectedJid, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newContactJid, setNewContactJid] = useState('');

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newContactJid && newContactJid.includes('@')) {
      const jid = newContactJid.trim().toLowerCase();
      import('../../../shared/services/xmppClient').then(({ xmppClient }) => {
        xmppClient.addContact(jid);
        const currentContacts = useChatStore.getState().contacts;
        useChatStore.setState({
          contacts: {
             ...currentContacts,
             [jid]: { jid, name: jid.split('@')[0], subscription: 'none', unreadCount: 0, presence: 'unavailable' }
          }
        });
        alert(`Pedido enviado para ${jid}! Vocês estarão conectados quando ele aceitar.`);
        setShowAddModal(false);
        setNewContactJid('');
      });
    } else if (newContactJid) {
      alert('Endereço XMPP inválido. Deve conter @.');
    }
  };

  // Busca simples. Debounce pode ser adicionado em buscas no lado do servidor.
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const lowerTerm = searchTerm.toLowerCase();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(lowerTerm) || 
      c.jid.toLowerCase().includes(lowerTerm)
    );
  }, [contacts, searchTerm]);

  return (
    <aside className="flex flex-col h-full bg-surface dark:bg-surface-dark border-r border-border w-full max-w-[340px] shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <header className="h-[72px] p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowProfileModal(true)}
            className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center hover:bg-brand/20 transition-colors shrink-0"
            aria-label="Meu Perfil"
          >
            <User className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold font-sans tracking-tight">Conversas</h2>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowAddModal(true)}
            aria-label="Adicionar contato XMPP"
            className="p-2.5 rounded-full hover:bg-brand/10 hover:text-brand transition-colors bg-black/5 dark:bg-white/5"
          >
            <UserPlus className="w-5 h-5 text-foreground" />
          </button>
          {onLogout && (
            <button 
              aria-label="Sair"
              onClick={onLogout}
              className="p-2.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Input de Busca */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
          <input
            type="text"
            placeholder="Buscar contatos..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/50 transition-shadow border border-transparent focus:bg-surface dark:focus:bg-surface-dark focus:border-border font-sans placeholder:text-muted"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Buscar na lista de contatos"
          />
        </div>
      </div>

      {/* Lista de Contatos */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ul role="list" className="p-2 space-y-[2px]">
          {filteredContacts.map(contact => (
            <li key={contact.jid}>
              <button
                onClick={() => onSelectContact(contact.jid)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group ${
                  selectedJid === contact.jid 
                    ? 'bg-brand text-white shadow-md shadow-brand/20' 
                    : 'hover:bg-black/5 dark:hover:bg-white/5 bg-transparent text-foreground'
                }`}
                aria-selected={selectedJid === contact.jid}
              >
                <div className="relative flex-shrink-0">
                  {contact.avatar ? (
                    <img 
                      src={contact.avatar} 
                      alt={`Avatar de ${contact.name}`}
                      width={52} 
                      height={52} 
                      className={`w-[52px] h-[52px] rounded-full object-cover transition-transform group-hover:scale-105 ${selectedJid === contact.jid ? 'border-2 border-white/20' : ''}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center font-semibold text-lg transition-transform group-hover:scale-105 ${selectedJid === contact.jid ? 'bg-white/20 text-white' : 'bg-brand/10 text-brand'}`}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Status Indicator */}
                  <span 
                    className={`absolute bottom-0 right-0.5 w-[14px] h-[14px] rounded-full border-[2.5px] transition-colors ${
                      selectedJid === contact.jid ? 'border-brand' : 'border-surface dark:border-surface-dark group-hover:border-[#F2F2F2] dark:group-hover:border-[#1E1E1E]'
                    } ${presenceColors[contact.presence]}`}
                    aria-label={`Status: ${contact.presence}`}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-[15px] truncate">{contact.name}</h3>
                  </div>
                  <p className={`text-[13px] truncate ${selectedJid === contact.jid ? 'text-white/80' : 'text-muted'}`}>
                    {contact.statusMessage || contact.jid}
                  </p>
                </div>
                
                {contact.unreadCount ? (
                  <div className="flex-shrink-0 pl-2">
                    <span className={`flex items-center justify-center text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1.5 ${selectedJid === contact.jid ? 'bg-white text-brand' : 'bg-brand text-white'}`}>
                      {contact.unreadCount}
                    </span>
                  </div>
                ) : null}
              </button>
            </li>
          ))}
          {filteredContacts.length === 0 && (
            <div className="text-center text-muted p-8 text-sm flex flex-col items-center gap-2">
              <UserPlus className="w-8 h-8 opacity-20" />
              <p>Nenhum contato encontrado.</p>
            </div>
          )}
        </ul>
      </div>

      {/* Modal Customizado para Adicionar Contato */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-surface-dark w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="p-6">
              <h3 className="text-xl font-bold font-sans text-brand mb-2">Adicionar Contato</h3>
              <p className="text-sm text-muted mb-6">Digite o endereço XMPP da pessoa que deseja conversar (ex: amigo@xmpp.jp).</p>
              
              <form onSubmit={handleAddContactSubmit} className="flex flex-col gap-4">
                <input
                  type="email"
                  autoFocus
                  placeholder="usuario@dominio.com"
                  className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:bg-surface dark:focus:bg-surface-dark transition-all text-[16px] font-sans"
                  value={newContactJid}
                  onChange={(e) => setNewContactJid(e.target.value)}
                />
                <div className="flex items-center justify-end gap-3 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl text-muted hover:bg-black/5 dark:hover:bg-white/10 font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={!newContactJid}
                    className="px-6 py-2.5 rounded-xl bg-brand text-white font-semibold shadow-md hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    Convidar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perfil */}
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </aside>
  );
};
