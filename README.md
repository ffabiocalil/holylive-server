# Holy Foods Live Server

Servidor WebSocket para o módulo IA Moderador do HolyLive.

## Deploy no Railway

1. Suba esse repositório no GitHub
2. Acesse railway.app e clique em "New Project → Deploy from GitHub"
3. Selecione o repositório
4. Em "Variables", adicione:
   - `ANTHROPIC_API_KEY` = sua chave
   - `ALLOWED_ORIGIN` = https://seu-holylive.lovable.app
5. Railway faz o deploy automático

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic |
| `ALLOWED_ORIGIN` | Domínio do HolyLive (para segurança) |
| `PORT` | Porta (Railway define automaticamente) |
