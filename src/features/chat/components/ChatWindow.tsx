import React, { useState, useRef, useEffect } from 'react';
import { Send, MoreVertical, Phone, Video, Smile } from 'lucide-react';
import { MessageBubble, MessageBubbleProps } from './MessageBubble';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface ChatContact {
  jid: string;
  name: string;
  avatar?: string;
  presence: string;
}

interface ChatWindowProps {
  contact: ChatContact;
  messages: MessageBubbleProps[];
  onSendMessage: (text: string) => void;
  isTyping?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  contact, 
  messages, 
  onSendMessage,
  isTyping 
}) => {
  const [inputText, setInputText] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtualizer: Obrigatório para performance caso o chat tenha milhares de mensagens (MAM)
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimativa de altura por balão
    overscan: 10,
  });

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (rowVirtualizer.getTotalSize() > 0 && messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  }, [messages.length, rowVirtualizer]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <main className="flex flex-col h-full w-full bg-[#F9FAFB] dark:bg-black/40">
      {/* Header Fixo */}
      <header className="h-[72px] px-4 sm:px-6 border-b border-border bg-surface dark:bg-surface-dark flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {contact.avatar ? (
              <img 
                src={contact.avatar} 
                alt={contact.name} 
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover"
                width={44} height={44}
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand/10 flex items-center justify-center text-brand font-semibold text-lg">
                {contact.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span 
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface dark:border-surface-dark ${
                contact.presence === 'available' ? 'bg-online' :
                contact.presence === 'away' ? 'bg-away' :
                contact.presence === 'dnd' ? 'bg-dnd' : 'bg-unavail'
              }`} 
              aria-label={`Status: ${contact.presence}`}
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-base sm:text-lg truncate">{contact.name}</h2>
            <p className="text-[13px] text-muted font-sans truncate">
              {isTyping ? <span className="text-brand animate-pulse">digitando...</span> : contact.presence}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="p-2 hidden sm:block rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors" aria-label="Chamada de áudio">
            <Phone className="w-[20px] h-[20px]" />
          </button>
          <button className="p-2 hidden sm:block rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors" aria-label="Chamada de vídeo">
            <Video className="w-[20px] h-[20px]" />
          </button>
          <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors" aria-label="Mais opções">
            <MoreVertical className="w-[20px] h-[20px]" />
          </button>
        </div>
      </header>

      {/* Área de Mensagens (Virtualizada) */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 scrollbar-thin"
        role="log"
        aria-live="polite"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={message.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageBubble {...message} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Input de Mensagem */}
      <footer className="p-3 sm:p-4 bg-surface dark:bg-surface-dark border-t border-border">
        <form 
          onSubmit={handleSend}
          className="max-w-5xl mx-auto flex items-end gap-2 bg-black/5 dark:bg-white/5 rounded-3xl p-1.5 transition-all focus-within:ring-1 focus-within:ring-brand/50 focus-within:bg-surface dark:focus-within:bg-surface-dark border border-transparent focus-within:border-border shadow-sm"
        >
          <button 
            type="button"
            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted transition-colors flex-shrink-0"
            aria-label="Inserir emoji"
          >
            <Smile className="w-6 h-6" />
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Mensagem..."
            className="w-full max-h-32 bg-transparent text-[16px] focus:outline-none resize-none py-3.5 px-2 scrollbar-thin font-sans"
            rows={1}
            style={{ minHeight: '52px' }} // 16px é o tamanho mínimo exigido para o iOS não fazer zoom!
            onKeyDown={(e) => {
              // Envia no Enter apenas, e permite Shift+Enter para quebra de linha
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />

          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="p-3.5 rounded-full bg-brand text-white hover:bg-indigo-600 disabled:opacity-50 disabled:bg-muted disabled:text-white/50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Enviar mensagem"
          >
            <Send className="w-[18px] h-[18px] translate-x-[2px] translate-y-[1px]" />
          </button>
        </form>
      </footer>
    </main>
  );
};
