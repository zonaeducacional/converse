import React, { useState, useMemo } from 'react';
import { Search, LogOut, Hash, ChevronRight, ChevronDown, MessageSquare } from 'lucide-react';
import { useZulipStore } from '../../../shared/store/useZulipStore';

interface ZulipSidebarProps {
  onLogout?: () => void;
}

export const ZulipSidebar: React.FC<ZulipSidebarProps> = ({ onLogout }) => {
  const { subscriptions, topics, setActiveChat, activeChat, loadTopics } = useZulipStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStreams, setExpandedStreams] = useState<Record<number, boolean>>({});

  const toggleStream = async (id: number) => {
    const isExpanding = !expandedStreams[id];
    setExpandedStreams(prev => ({ ...prev, [id]: isExpanding }));
    if (isExpanding) {
      await loadTopics(id);
    }
  };

  const filteredSubs = useMemo(() => {
    if (!searchTerm) return subscriptions;
    const lowerTerm = searchTerm.toLowerCase();
    return subscriptions.filter(s => s.name.toLowerCase().includes(lowerTerm));
  }, [subscriptions, searchTerm]);

  return (
    <aside className="flex flex-col h-full bg-surface dark:bg-surface-dark border-r border-border w-full max-w-[340px] shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      <header className="h-[72px] p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-xl font-semibold font-sans tracking-tight">Canais Zulip</h2>
        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-2.5 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </header>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
          <input
            type="text"
            placeholder="Buscar canais..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/50 transition-shadow border border-transparent focus:bg-surface dark:focus:bg-surface-dark focus:border-border font-sans placeholder:text-muted"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ul className="p-2 space-y-1">
          {filteredSubs.map(sub => (
            <li key={sub.stream_id} className="flex flex-col">
              <button
                onClick={() => toggleStream(sub.stream_id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  activeChat?.to === sub.name ? 'bg-brand/10 text-brand' : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Hash className="w-5 h-5 opacity-70" />
                <span className="flex-1 font-semibold truncate">{sub.name}</span>
                {expandedStreams[sub.stream_id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {expandedStreams[sub.stream_id] && (
                <ul className="ml-8 mt-1 space-y-1 border-l-2 border-brand/10 pl-2">
                  {topics[sub.stream_id]?.map(topic => (
                    <li key={topic.name}>
                      <button
                        onClick={() => setActiveChat({ type: 'stream', to: sub.name, topic: topic.name, streamId: sub.stream_id })}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-all text-left ${
                          activeChat?.to === sub.name && activeChat?.topic === topic.name 
                            ? 'bg-brand text-white shadow-sm' 
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3 opacity-50" />
                        <span className="truncate">{topic.name}</span>
                      </button>
                    </li>
                  ))}
                  {(!topics[sub.stream_id] || topics[sub.stream_id].length === 0) && (
                    <li className="p-2 text-xs text-muted italic">Carregando tópicos...</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
