# Meu XMPP (PWA Web Client)

Plataforma profissional de mensageria federada construída como PWA (Progressive Web App), focada em performance, funcionamento offline-first e design UI Pro Max (Glassmorphism, Dark Mode).

## 🚀 Objetivo do Projeto
Criar um cliente Web XMPP 100% descentralizado e instalável em qualquer dispositivo (Desktop/Mobile) que seja robusto o suficiente para funcionar com internet intermitente, oferecendo a experiência de um aplicativo nativo moderno.

## 🛠 Tech Stack
- **Frontend Core:** React 18 + Vite 5 + TypeScript (Strict)
- **Protocolo XMPP:** `@xmpp/client` (WebSocket primário com BOSH via Polyfills de Node.js no Vite)
- **Design System:** Tailwind CSS v3 (Custom Tokens) + Framer Motion (Micro-interações)
- **Offline / PWA:** Workbox (Service Workers) + vite-plugin-pwa
- **Persistência Local:** Dexie.js (Wrapper IndexedDB)
- **Estado Global:** Zustand (Otimizado com Optimistic UI)
- **Performance:** `@tanstack/react-virtual` para renderizar infinitas mensagens sem lag.

## 💻 Setup e Execução (Dev)

### Requisitos:
- Node.js >= 18

### Como Rodar:
1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as credenciais no arquivo `.env` (Use o modelo base):
   ```env
   VITE_XMPP_DOMAIN=xmpp.jp
   VITE_XMPP_WS_URL=wss://www.xmpp.jp/ws/
   VITE_XMPP_BOSH_URL=https://www.xmpp.jp/http-bind/
   ```
4. Inicie o servidor:
   ```bash
   npm run dev
   ```

## 🌐 Deploy e Build (Produção)
Para empacotar a aplicação de forma otimizada:
```bash
npm run build
```
O diretório `dist` conterá o bundle minifyado e o Manifest PWA pronto para ser hospedado no Cloudflare Pages, Surge.sh ou Netlify.

## 📝 Changelog / Histórico de Funcionalidades

- **v1.0.0-auth:**
  - Configuração do Vite com Polyfills do Node para suporte a SASL Authentication.
  - Layout Base Responsivo (Tailwind, Dark Mode).
  - Virtualização da lista de mensagens.
  - Implementação da Store (Zustand) + IndexedDB (Dexie) para loop de gravação local.
  - Autenticação e roteamento dinâmico via XMPP funcionando (Mensagens de e para o próprio JID roteadas pelo servidor).

---
*Projeto desenvolvido sob as diretrizes de "Vibe Coding" — Vibe máxima, zero engasgos, foco no usuário final.*
