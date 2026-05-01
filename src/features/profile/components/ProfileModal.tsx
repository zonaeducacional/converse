import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, X, User } from 'lucide-react';
import { xmppClient } from '../../../shared/services/xmppClient';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const [fullName, setFullName] = useState('');
  const [statusText, setStatusText] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const jid = xmppClient.getClient()?.jid?.bare().toString() || '';

  useEffect(() => {
    // Busca o vCard do próprio usuário
    xmppClient.fetchVCard().then(vCard => {
      if (vCard) {
        setFullName(vCard.fullName || '');
        setStatusText(vCard.statusText || '');
        setAvatar(vCard.avatarBase64 || null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Converte a imagem para Base64 Redimensionada (Otimização para XMPP)
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256; // Avatares pequenos em XMPP
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Comprime para JPEG qualidade media
        setAvatar(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await xmppClient.publishVCard({
        fullName,
        statusText,
        avatarBase64: avatar || undefined
      });
      alert('Perfil atualizado com sucesso!');
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Falha ao salvar perfil. Servidor rejeitou a atualização. Erro: ' + (err.message || 'Desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface dark:bg-surface-dark w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
        
        <div className="relative h-24 bg-gradient-to-r from-brand to-indigo-600">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex justify-center -mt-12 mb-4">
            <div className="relative group">
              {avatar ? (
                <img 
                  src={avatar} 
                  alt="Seu Avatar" 
                  className="w-24 h-24 rounded-full object-cover border-4 border-surface dark:border-surface-dark shadow-lg bg-surface"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-surface dark:border-surface-dark shadow-lg bg-brand/10 flex items-center justify-center text-brand">
                  <User className="w-10 h-10" />
                </div>
              )}
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-brand text-white rounded-full shadow-md hover:scale-105 transition-transform"
                title="Mudar foto"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleFileChange} 
              />
            </div>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-bold font-sans text-foreground">{jid.split('@')[0]}</h3>
            <p className="text-[13px] text-muted">{jid}</p>
          </div>

          {loading ? (
            <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-muted ml-1 uppercase tracking-wider">Nome de Exibição</label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:bg-surface transition-all text-[15px]"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-muted ml-1 uppercase tracking-wider">Recado (Status)</label>
                <input
                  type="text"
                  placeholder="Disponível"
                  className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:bg-surface transition-all text-[15px]"
                  value={statusText}
                  onChange={e => setStatusText(e.target.value)}
                  maxLength={60}
                />
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="mt-2 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-brand text-white font-semibold shadow-[0_8px_20px_rgba(var(--brand),0.3)] hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
