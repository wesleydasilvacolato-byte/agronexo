# AGRONEXO

Plataforma responsiva de apoio à agronomia, gestão de propriedades e conhecimento técnico.

## Módulos disponíveis
- Dashboard e atalhos
- 49 calculadoras agronômicas, com fórmulas, unidades e ressalvas técnicas
- Bulário de pesquisa com base nos dados públicos AGROFIT/MAPA
- **Sebastião**, assistente agronômico com integração **Google Gemini**
- Mensagens de texto, OCR/análise de fotos, transcrição de áudio e vídeos curtos
- Histórico local de conversas, propriedades, cotações e caderno de campo

## Colocando o Sebastião em funcionamento
Configure **GEMINI_API_KEY** (e opcionalmente **GEMINI_MODEL**) exclusivamente nas variáveis de ambiente de produção da Vercel. Consulte instruções detalhadas em [DEPLOY.md](./DEPLOY.md). Não inclua a chave em código, tickets ou arquivos públicos.

> **Termos do Gemini:** o uso de Google AI Studio/Gemini API exige idade mínima de 18 anos e restringe clientes de API que provavelmente possam ser acessados por menores. A integração está pronta, mas deve permanecer sem credencial até existir operador e público elegíveis e controles de acesso adequados. Consulte [termos oficiais](https://ai.google.dev/gemini-api/terms).

A modalidade gratuita do Gemini não oferece capacidade ilimitada; limites do Google são por projeto/modelo. O histórico do chat textual, assim como projetos, cotações e caderno de campo, é sincronizado no **Supabase por conta** desde a versão 1.7, com cópia local para indisponibilidade de rede. O histórico das calculadoras permanece local. Para uso público ou comercial, implemente autenticação, limitação persistente de consumo, políticas de privacidade e backups.

> **Aviso agronômico:** informações e estimativas não substituem recomendações oficiais, rótulo/bula vigente, laboratório, engenheiro agrônomo ou responsável técnico habilitado.

### Compatibilidade de modelos (outubro/2026)
O Sebastião prioriza `gemini-3.5-flash-lite`, pois o Google limitou o Gemini 2.5 para novos projetos. Em resposta 404 pode tentar `gemini-3.1-flash-lite`. Não faz alternância para contornar erros de cota, chave ou políticas.

## Identidade visual da plataforma

Identidade oficial aplicada em todas as seções com base no **Agronexo_Identidade_Visual.pdf** e **Sebastiao_Agronexo_Apresentacao-1.pdf** fornecidos pelo responsável pela marca.

- Logotipo institucional: emblema Agronexo original, sem redesenho nem alteração de proporções.
- Símbolo compacto: ícone original para identificação de app e cabeçalho.
- Mascote Sebastião: imagens originais do manual, avatar no chat e no menu lateral e pose de corpo inteiro na tela inicial.
- Paleta obrigatória: **#006B3F** (Agronexo), **#123C2B** (profundo), **#A6CE39** (lima), **#D8E8CC** (sálvia), **#F5F7F0** (marfim) e branco.
- Montserrat para títulos, botões, navegação e conteúdo. O nome dentro do logotipo é arte original e **não é redigitado**.
- Os arquivos de identidade foram extraídos diretamente dos documentos de marca, otimizados como WebP sem redistensão e incluídos em `src/brand-assets.js`. Não contêm chaves de API.

O navegador utiliza o mesmo conjunto de identidade no dashboard, chat, calculadoras, bulário, projetos, cotações, caderno de campo, configurações, menu e favicon.

## Melhorias de usabilidade e bulário (v1.2)
- Chat com altura baseada na viewport visual (barra do navegador/teclado), rolagem interna das mensagens, compositor acessível e histórico móvel.
- Layouts com largura flexível, rolagem de tabelas e modais e cartões de resultado para os registros AGROFIT.
- Bulário busca na base pública do MAPA, primeiro pelo índice DataStore/CKAN (quando habilitado), depois processando o CSV público em fluxo. Não é necessário token da Embrapa.
- Pesquisa por ingrediente ativo, marca e registro; fichas de nome, concentração, classe, registro, titular e classificações quando presentes na fonte.
- **Não afirmar que há bula completa para todos os registros:** o CSV não fornece necessariamente o PDF. Quando existe link oficial verificável, o programa pode mostrá-lo; nos demais casos, fornece acesso à [Consulta Aberta AGROFIT](https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons) para verificação da bula vigente.
- A disponibilidade e a latência dependem da infraestrutura oficial. Se a base não responder, o sistema apresenta erro claro e oferece a consulta no MAPA, sem inventar registro ou dose.

### Consulta complementar de bulas na Embrapa
Ao abrir as informações de um produto, a opção **Procurar ficha na Embrapa** verifica, em tempo real, se existe uma página pública correspondente no [ATER+ Digital / Controle de Pragas](https://www.atermaisdigital.cnptia.embrapa.br/web/controle-de-pragas). O sistema só mostra o link quando o endereço e o nome do produto forem confirmados. Uma página pode listar documentos de tipo **Bula**, mas não é garantia de PDF para todos os produtos. Para decisões técnicas, prevalece a bula vigente e o registro MAPA.

## Correção do bulário — índice AGROFIT (outubro de 2026)
O endpoint `/api/bulario?q=glifosato` agora pesquisa **um índice compactado produzido na implantação**. O processo de build `scripts/build-agrofit.mjs` descarrega uma única vez o CSV público completo do MAPA, extrai os campos cadastrais, remove duplicações, organiza partições por prefixo e gera arquivos gzip utilizados pela API. A compilação **falha** se o índice não contiver dados oficiais verificáveis (incluindo um registro com ingrediente ativo glifosato). Isso substitui a tentativa anterior de baixar mais de 175 MB a cada pesquisa.

O índice é um retrato do AGROFIT na data de publicação, **não uma atualização em tempo real**. Para atualizar diariamente, será preciso automatizar nova compilação/publicação. O dataset de produtos formulados não inclui necessariamente um PDF oficial de bula para cada produto: o AGRONEXO fornece o registro e acesso ao portal do MAPA e, quando confirmada, a ficha pública da Embrapa.

Diagnóstico simples: `/api/bulario?status=1` (informará a data de construção, quantidade de registros e situação do índice). Não expõe credenciais.

## Auditoria e regressão — versão 1.4
- 49 calculadoras mantidas, agora com validação de campos vazios, divisores e percentuais fora do limite. Cada fórmula tem validação de finitude; os testes automatizados verificam os 49 exemplos e vários casos físicos.
- Corrigido risco de resposta atrasada do Sebastião substituir outra seção do aplicativo.
- Pesquisa de ingredientes ativos com pontuação, como `2,4-D`, tratada com normalização compatível com as partições do índice.
- Backups são normalizados antes de restaurar e excluões têm confirmação, preservando os dados existentes no navegador.
- Pipeline `npm run build`: testes de unidade, criação de índice oficial e smoke test real da API contra o índice publicado. Uma falha interrompe a publicação.

**Pendências para produção pública:** autenticação individual, banco persistente com sincronização, controle compartilhado de limites de API, observabilidade, auditoria técnico-agronômica das fórmulas e verificação real dos serviços externos. Um build READY comprova a construção, não valida por si só o navegador do usuário nem chamadas ao Gemini.

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

## Sincronização entre dispositivos (v1.7)

- A tabela `public.agronexo_workspace_records` aplica políticas RLS para leitura/gravação apenas pelo proprietário autenticado. A API `/api/workspace` valida sessão, PIN e identidade do usuário no servidor, sem aceitar `user_id` de clientes.
- Coleções sincronizadas: propriedades/projetos, cotações, caderno de campo e conversas textuais do Sebastião. Arquivos anexados ao chat não são armazenados; somente mensagem e transcrição ficam no histórico.
- Na primeira abertura após atualização, os dados antigos deste navegador são importados sem substituir registros existentes na nuvem. A cópia local permanece. Para migrar dados de outros aparelhos, entre no mesmo usuário em cada dispositivo.
- Uma fila local conserva inclusões, edições e exclusões durante falha de conexão. A sincronização é reexecutada ao recuperar foco ou conexão e pelo botão em Configurações. Exclusões usam marcadores persistentes para impedir restauração involuntária.
- O histórico das calculadoras permanece no armazenamento do navegador. Colisões simultâneas sobre o MESMO item são resolvidas pela última gravação confirmada; evite editar a mesma conversa em dois dispositivos ao mesmo tempo.
- A tela de configurações mostra o estado da sincronização. Use **Exportar backup JSON** antes de limpar o navegador.
- Migração SQL: `sql/003_workspace_sync.sql`. Testes: `tests/workspace-sync.test.mjs`.


## Modo offline (v1.8)
- **Primeiro acesso online obrigatório.** Após autenticar e validar o PIN online, o aparelho recebe uma autorização offline de até sete dias. A opção **Configurações → Habilitar acesso offline** permite renovar a autorização digitando o PIN novamente enquanto há internet.
- O PWA guarda **somente HTML, CSS, JavaScript, ícones e o manifesto públicos** em Cache Storage. Endpoints `/api/*`, credenciais e conteúdo pessoal não são adicionados ao cache da service worker.
- Para abrir com internet indisponível, abra o aplicativo já instalado (ou a página previamente cacheada) e digite o PIN offline. Depois é possível abrir **calculadoras**, salvar resultados no histórico local, ver/escrever **caderno de campo**, projetos e cotações e consultar conversas textuais já sincronizadas.
- **Sebastião IA, novas transcrições e busca no AGROFIT exigem internet. O painel administrativo não é liberado offline.** O resultado de cálculos permanece local; os projetos, cotações, notas e conversas do Sebastião usam a fila `agronexo-cloud-v1` previamente implementada.
- Ao retornar a conexão o cliente só envia pendências depois de revalidar a sessão e o PIN online. Se tiver expirado, use **Configurações → Entrar novamente para sincronizar**, que não apaga o cache de dados nem a fila de trabalho.
- O PIN não é armazenado em texto simples. A autorização local é cifrada com chave derivada via PBKDF2/AES-GCM no WebCrypto e aplica bloqueio após erros. **Os documentos pessoais já salvos no localStorage não estão criptografados; não utilizar dispositivos compartilhados ou comprometidos.** A revogação de usuários não pode ser aplicada ao aparelho até ele conectar ou a autorização offline expirar em até sete dias.
- Não remova os dados do navegador nem desinstale o PWA antes de ver **Salvo na nuvem** e exportar um backup. Armazenamento do navegador pode ser removido pelo sistema operacional em caso de espaço insuficiente.
- Testes automatizados em `tests/offline-first.test.mjs` validam PIN, bloqueio, expiração e cache. Teste real em Android/iPhone com modo avião continua recomendado.
