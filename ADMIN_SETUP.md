# AGRONEXO · Ativação segura do painel administrativo

## O que já está implementado

- Login exclusivamente com e-mail e senha, sem tela pública de criação de contas.
- Sessão persistente de 14 dias em cookie `HttpOnly; Secure; SameSite=Lax`, criptografado com AES-256-GCM.
- PIN de 4 dígitos apenas após senha; acesso por dispositivo durante a sessão válida, com bloqueio atômico por banco após 5 tentativas incorretas e 15 minutos de espera.
- Painel `/admin.html` exclusivo para perfis `role=admin`; listas, métricas de acesso nos últimos 15 minutos, pesquisa, criação, suspensão/reativação, redefinição de senha/PIN e auditoria.
- Histórico local separado por conta no mesmo dispositivo; migração legada somente para administrador no primeiro login.
- PWA com manifesto, ícones oficiais Agronexo (192/512px) e service worker que **não armazena respostas de APIs ou credenciais**.
- Proteção de chat, transcrição, bulário e fichas por autenticação e PIN no servidor.

## Conta administrativa inicial — convite enviado

A conta de administrador **wesledasilvacolato@gmail.com** foi criada no Supabase Auth por convite de e-mail. O perfil `role=admin` está em `public.agronexo_profiles`. A variável sensível da Vercel está atualmente nomeada `SUPABASE_KEY`, reconhecida pelo backend como alias de `SUPABASE_SERVICE_ROLE_KEY`. A compilação de convite foi disparada na **prévia** por `ADMIN_BOOTSTRAP_ONCE=1`; após a emissão, essa variável foi alterada para `0`.

Abra o convite no e-mail e defina uma senha **nova de 12 caracteres ou mais** na página do Agronexo. Depois, configure um PIN de 4 dígitos. Nunca cole o link do convite em chats ou sistemas públicos porque pode conter tokens privados.

A URL de prévia é `https://agronexo-git-main-colato1.vercel.app`. Para aceitar convites, o Supabase Auth deve permitir essa URL em **Authentication → URL Configuration → Redirect URLs**. Caso o link não seja redirecionado corretamente, ajuste essa configuração no painel Supabase antes de solicitar novo convite. A publicação de produção deve ocorrer **após** a validação do login, PIN, permissões administrativas e das APIs protegidas.

## Para ativar em produção — obrigatório

1. **Conecte o Supabase à conversa ou crie um projeto em https://supabase.com/dashboard**. Não compartilhe chaves por mensagem.
2. No SQL Editor do Supabase, aplique `sql/001_auth_admin.sql`.
3. Em Authentication → Providers / Settings, habilite o login por e-mail e **DESABILITE o cadastro público (Allow new users to sign up)**. Só as rotas administrativas do AGRONEXO deverão criar usuários.
4. Na Vercel → AGRONEXO → Settings → Environment Variables, cadastre em Production, como variáveis secretas:
   - `SUPABASE_URL`: URL HTTPS do projeto
   - `SUPABASE_ANON_KEY`: chave pública `anon` do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta `service_role` (somente servidor)
   - `AUTH_SESSION_SECRET`: 32 bytes criptograficamente aleatórios em base64. Exemplo para **gerar no seu computador**: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
5. Para novos ambientes, a conta inicial pode ser convidada por `npm run bootstrap:admin` em ambiente controlado; a rotina exige `ADMIN_INVITE_REDIRECT` e executa apenas sob solicitação explícita no build.
   - `ADMIN_EMAIL` — e-mail exato informado pelo proprietário, configurado como padrão no script.
   - `ADMIN_INITIAL_PASSWORD` — uma **nova senha forte e exclusiva** de pelo menos 12 caracteres. **Não reutilize a senha que foi compartilhada em uma conversa.**
6. Após configurar o Supabase, faça implantação de prévia, teste login, configuração do PIN, bloqueio de PIN, acesso restrito a `/admin.html`, criação e suspensão de contas e revogação de sessões; só então promova para Production.
7. A senha inicial não é exibida no GitHub, não aparece na resposta da API e não é salva na auditoria. O administrador deve compartilhar credenciais iniciais com cada usuário por canal privado.

## Limitações e medidas extras

- A atividade “online” é uma aproximação do último acesso autenticado dentro de 15 minutos.
- O banco controla contas, sessões e auditoria, **não sincroniza ainda conversas, áreas, cotações e anotações**. Para isso, implemente tabelas por usuário com RLS e sincronização.
- A limitação distribuída de chamadas exige Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) ou equivalente. O fallback em memória NÃO é proteção suficiente para uso irrestrito.
- O PIN NÃO substitui senha forte; um novo dispositivo sempre exige e-mail e senha. A sessão expirará e exigirá novo login.
- Não exponha a chave `service_role` nem `AUTH_SESSION_SECRET` no código cliente, imagens, repositório ou prints.
- Para mudanças de senha do administrador, use o processo de recuperação autenticado do Supabase, não uma rota administrativa autogerenciada sem reautenticação.
- O PWA pode ser instalado como aplicativo web, mas não é um binário nativo da Play Store/App Store.
- Solicitações ao Google Gemini precisam observar seus termos de elegibilidade e privacidade; habilitar contas não altera os termos do fornecedor.

## Documentação de teste

`npm test` testa calculadoras, navegação, envelope criptografado, PIN e PWA.
`npm run test:security` testa limites e proteção HTTP.
`npm run build` também produz e valida o índice AGROFIT/MAPA sem contornar as rotas protegidas do aplicativo.
