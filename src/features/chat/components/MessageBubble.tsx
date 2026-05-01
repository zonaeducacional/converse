import React from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck } from 'lucide-react';

export interface MessageBubbleProps {
  id: string;
  content: string;
  timestamp: string; // ISO String
  isOwn: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  timestamp,
  isOwn,
  status
}) => {
  // Formata o timestamp absoluto e extrai apenas a hora local para exibição no balão
  const timeFormatted = new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Animação super leve e rápida, exigida: 150ms
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`flex w-full mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
      role="listitem"
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] px-4 py-2 shadow-sm ${
          isOwn 
            ? 'bg-brand text-white rounded-2xl rounded-br-sm' 
            : 'bg-surface border border-border text-foreground rounded-2xl rounded-bl-sm dark:bg-surface-dark dark:border-border'
        }`}
      >
        {/* Zulip pode retornar HTML. Para simplificar, renderizamos como texto ou HTML se detectar tags */}
        {content.includes('<') && content.includes('>') ? (
          <div 
            className="text-[15px] leading-relaxed break-words font-sans zulip-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words font-sans">
            {content}
          </p>
        )}
        
        <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] font-mono ${isOwn ? 'text-indigo-200' : 'text-muted'}`}>
          {/* O timestamp completo (absoluto) vai no title (hover) */}
          <span title={new Date(timestamp).toLocaleString('pt-BR')} aria-label={`Enviado às ${timeFormatted}`}>
            {timeFormatted}
          </span>
          
          {isOwn && status && (
            <span aria-label={`Status: ${status}`} className="ml-0.5">
              {status === 'sending' && <Check className="w-[14px] h-[14px] opacity-50" />}
              {status === 'sent' && <Check className="w-[14px] h-[14px]" />}
              {(status === 'delivered' || status === 'read') && (
                <CheckCheck className={`w-[14px] h-[14px] ${status === 'read' ? 'text-blue-300' : ''}`} />
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
