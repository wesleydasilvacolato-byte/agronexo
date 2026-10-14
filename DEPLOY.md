# AGRONEXO — implantação com Google Gemini

## Arquitetura
- Front-end estático em `index.html`, `style.css` e `src/app.js` (dashboard e chat).
- 49 calculadoras com fórmulas e orientações em `src/calculators.js`.
- `lib/gemini.js`: gateway seguro para a API Gemini, sem chave no navegador, validação de arquivos e limitação básica por IP.
- `api/chat.js`: chat contextual multimodal (texto, OCR por modelo visual, imagens e vídeos curtos).
- `api/transcribe.js`: transcrição de áudio (WebM, MP3, WAV etc.) via Gemini.
- `api/status.js`: status não sensível da integração, indicando apenas se a chave está configurada.
- `api/bulario.js`: consulta ao CSV público AGROFIT/MAPA, independente da IA.

## Configuração da API Gemini
1. Consulte os [termos do Gemini](https://ai.google.dev/gemini-api/terms). **A API e o AI Studio exigem 18 anos ou mais** para uso e restringem apps voltados a menores ou provavelmente acessados por eles. Uso por pessoa inelegível não deve ser contornado por credencial de outra pessoa.
2. Se e somente se o operador e o público atenderem aos termos, um responsável elegível pode acessar [Google AI Studio - API Keys](https://aistudio.google.com/app/apikey), selecionar o projeto Google Cloud apropriado e criar uma chave da API, verificando o free tier disponível.
3. Na Vercel, projeto `agronexo` → Settings → Environment Variables, adicione `GEMINI_API_KEY` com o valor da chave, como tipo sensível para Production. Opcional: `GEMINI_MODEL=gemini-3.5-flash-lite`.
4. Reimplante o ambiente Production para injetar a nova variável. Verifique `/api/status`: `provider: gemini` e `assistantConfigured: true`.
5. Faça testes com perguntas técnicas, foto, áudio WebM e vídeo curto. `/api/status` não valida cobrança, validade ou permissão da chave.

## Gratuidade e segurança
- A modalidade gratuita do Gemini é limitada por projeto e modelo. Verifique RPM, TPM e RPD no [AI Studio](https://aistudio.google.com) e preços em https://ai.google.dev/gemini-api/docs/pricing . **Não é ilimitada**.
- A camada gratuita pode ser utilizada pelo fornecedor para melhoria de produtos, conforme seus termos. Não envie dados pessoais sensíveis ou informações de clientes sem política apropriada e autorização.
- O proxy aplica limitação simplificada por IP em memória (não persistente). **Para acesso público é necessário login, proteção antifraude e rate limiting em armazenamento compartilhado**; caso contrário, terceiros podem esgotar a cota.
- Uma chave `OPENAI_API_KEY` antiga é ignorada por esta versão. Se desejar, revogue-a no provedor original e remova a variável obsoleta da Vercel por segurança.

## Multimídia e limites
- Imagens são redimensionadas no navegador e enviadas por HTTPS ao servidor, que consulta o Gemini sem expor a chave.
- Áudios são transcritos em uma chamada, e a transcrição é salva junto à mensagem; depois o chat recebe a transcrição e produz a resposta. Isso consome **duas chamadas** Gemini por mensagem de áudio.
- Vídeo até cerca de 2,2 MB em formato MP4/WebM é passado diretamente ao Gemini. Arquivos maiores são representados por três quadros JPEG; nesse modo o **áudio e partes do vídeo não são analisados**.
- Requisições Vercel Functions têm limite de corpo de aproximadamente 4,5 MB. Mídia e histórico podem precisar de solução de upload externo para volumes maiores.

## Histórico
- Conversas, transcrições, cálculos, áreas e cotações permanecem no `localStorage` do navegador (exportação JSON pela tela Configurações). Não há sincronização entre aparelhos, login, backups gerenciados nem histórico de anexos binários.
- Antes de disponibilizar a plataforma ao público, é necessário banco PostgreSQL com autenticação, políticas de acesso, backups, moderação, proteção contra abuso e política de privacidade.

## Fonte agrícola
- Dados públicos AGROFIT/MAPA: https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit . Verifique a vigência de registro, cultura autorizada e bula antes de qualquer aplicação. Sebastião não substitui agrônomo ou responsável técnico.

## Validação mínima
1. Na Vercel, confirme deployment `READY` e funcionamento de `/api/status`.
2. Carregue página principal e visite todos os módulos.
3. Em Calculadoras, faça um teste de cada um dos 11 grupos.
4. Sem chave configurada, o chat deve mostrar erro de configuração claro, nunca travar.
5. Com credencial **válida e utilização permitida pelos termos**, verificar separadamente texto, imagem, áudio e vídeo pequeno.

## Correção 404 em projetos novos (outubro/2026)
A documentação do Google restringe modelos 2.5 a projetos previamente ativos. O padrão agora é `gemini-3.5-flash-lite`; se esse modelo retornar 404, o gateway tenta `gemini-3.1-flash-lite`. Em erros de autenticação, cota ou segurança não há alternância de modelo. Uma variável GEMINI_MODEL definida explicitamente tem prioridade, mas 404 pode ativar os dois modelos gratuitos de contingência. Consulte https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash e https://ai.google.dev/gemini-api/docs/pricing .

## Bulário e correções de rolagem (v1.2)
- A API /api/bulario consulta o DataStore CKAN do MAPA; se não disponível, lê o CSV oficial incrementalmente com limitação de tempo e tamanho. Não solicita token.
- Para testar, pesquise ingrediente ativo 'glifosato' ou 'atrazina' (somente quando a base oficial estiver acessível); confirme que os registros retornados mostram a fonte. Testes simulados não substituem essa verificação externa.
- Bulas individuais: o dataset de cadastro não garante documentos PDF. A interface leva à Consulta Aberta AGROFIT e só mostra documento direto quando a própria fonte registrar um endereço oficial verificável.
- Teste o chat em telas de 360px, 768px, 1024px e desktop, com resposta muito longa, teclado aberto e histórico; a região de mensagens é o elemento rolável e o compositor permanece visível.
- Vercel pode impedir o acesso da integração automatizada a endpoints protegidos. Verifique chamadas reais pelo browser com acesso ao projeto.

### API /api/bula
Consulta complementar por nome comercial, com normalização do slug, validação de domínio e título. Não explora/copia PDFs em massa nem constrói links não confirmados. Teste com um nome comercial efetivamente presente no portal ATER+ Digital da Embrapa. Se a Embrapa estiver indisponível, a interface indica a consulta AGROFIT como alternativa.

## Publicação do índice AGROFIT v1.3
- Build: `npm run build` roda `scripts/build-agrofit.mjs` e prepara arquivos de interface em `public/`.
- API: `/api/bulario?q=glifosato` lê apenas a partição gzip do índice. `vercel.json` inclui as partições geradas na função. Não há download de 175 MB por requisição.
- Compilação protege produção: se a fonte MAPA estiver indisponível, se não houver registros suficientes ou se 'glifosato' estiver ausente, o build falhará e o deploy anterior permanecerá ativo.
- Verifique `/api/bulario?status=1`: espera-se `indexed: true` e `uniqueProducts > 0`. Depois pesquise por 'glifosato' e 'atrazina'.
- A fonte declara atualização diária; o índice da publicação só é atualizado na próxima construção. Automatizar rebuild diário quando o fluxo de CI/CD estiver conectado.
- PDFs de bulas não estão integralmente incluídos no dataset público formulado. Não exibir links de PDF não verificados.

## Release v1.4: verificações automáticas
`npm test` executa os testes de 49 calculadoras, limites numéricos e navegação básica com DOM simulado.
`npm run build` primeiro roda testes, depois obtém e valida os dados oficiais do MAPA, e finalmente executa `npm run test:index` para verificar uma pesquisa real por glifosato e que não existem resultados fictícios em nomes inexistentes.
Os testes com DOM simulado **não** substituem validação manual de responsividade e toque em Chrome/Android, Safari/iOS e desktop. Da mesma forma, testar o código do Gemini não representa resposta efetiva do serviço remoto.

## Segurança e experiência mobile-first — v1.5 (outubro de 2026)

**Implementado nesta versão:**
- Navegação inferior com cinco ações em celular/tablet, menu lateral com sombra e botão de fechar, uso de safe area, teclado virtual, alvos de toque de 44 px, rolagem independente do chat, formulários maiores e cartões responsivos.
- Políticas de navegador via headers (Content-Security-Policy, HSTS, anti-framing, Permissions-Policy e proteção MIME).
- Endpoints Gemini com POST JSON e limite de tamanho, validação de origem no navegador e rejeição de chamadas cross-site. Não confundir verificação de origem com autenticação: clientes externos podem forjar cabeçalhos.
- Limitação de requisições por IP: memória por instância na fase beta. Opcionalmente, `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` habilitam limitação distribuída; se o Redis configurado falhar, a API retorna 503 e não consome IA.
- Validação mais estrita de histórico, imagens, áudios e vídeo para reduzir abuso da cota Gemini.
- Limpeza consciente dos dados do dispositivo na página Configurações, com confirmação explícita.
- Testes de segurança e regressão móvel integrados ao build da Vercel.

**Ainda não pronto para abertura pública irrestrita:**
1. **Autenticação** por usuário (recomendado Supabase Auth), proteção individual das rotas e recuperação de conta.
2. **Banco de dados persistente** (Postgres com RLS), backups e controle de acesso para conversas, propriedades e anexos; o histórico atual continua local no navegador.
3. **Rate limiting distribuído efetivo**: configurar Upstash Redis, validar limites por usuário autenticado e impor orçamento de IA.
4. **Política de privacidade, transparência sobre uso do Gemini** e consentimento/condições legais dos serviços.
5. **Teste manual em dispositivos físicos**, observabilidade, testes de penetração e validação agronômica da precisão das recomendações e fórmulas.

A implantação de uma interface responsiva não torna a plataforma automaticamente segura para produção. Não publique o acesso a uma grande audiência sem concluir os itens acima.
