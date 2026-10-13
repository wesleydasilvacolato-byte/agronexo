# AGRONEXO — publicação e operação

## Estrutura
- `index.html`, `style.css`, `src/app.js`: frontend estático e responsivo.
- `src/calculators.js`: 49 calculadoras, com fórmulas, unidades e notas técnicas.
- `api/bulario.js`: busca servidor-side em CSV público AGROFIT/MAPA (sem API key).
- `api/chat.js`: OpenAI Responses API, texto e interpretação de imagens/quadros de vídeo.
- `api/transcribe.js`: conversão de áudio para texto pela OpenAI.
- `api/status.js`: diagnóstico de configuração.

## Publicação
1. Importe este repositório na Vercel, com Framework Preset: Other, diretório raiz, sem comando de build.
2. Configure `OPENAI_API_KEY` em Project > Settings > Environment Variables. Opcional: `OPENAI_MODEL=gpt-4.1-mini`.
3. Reimplante para ativar as variáveis.
4. Confira `/api/status` e o chat Sebastião.

## Bulário
Dados abertos do Ministério da Agricultura e Pecuária (AGROFIT, produto formulado):
https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
Licença informada na fonte: CC BY. O servidor faz download temporário e busca no CSV, armazenando cache em memória por até seis horas quando possível. Não é cópia integral do site Embrapa, nem substitui rótulo, bula e registro atualizados.

## Persistência
Nesta primeira implementação, chats, propriedades, cotações e anotações são mantidos em localStorage no navegador e podem ser exportados/importados nas Configurações. Para produção com múltiplos usuários é necessário autenticação (Supabase Auth, por exemplo), banco PostgreSQL com políticas RLS, backups, permissões e consentimento para dados.

## Limites
- Necessária chave **paga por uso** da API OpenAI. Assinatura ChatGPT não é token de API.
- Análise de vídeo por amostragem de 3 frames; sem reconhecimento contínuo nem transcrição da trilha sonora do vídeo.
- Calculadoras 18, 20, 23, 26 e 27, entre outras, requerem tabelas/coefs regionais fornecidos pelo usuário; **não geram recomendação agronômica validada**.
- Tratamento de pragas, doses e registro: conferir bulas oficiais, responsável técnico e conformidade legal.
- Não usar chave de API dentro do frontend ou em commits.

## Testes sugeridos
- Navegar em todas as oito seções no celular e computador.
- Calcular uma ferramenta de cada grupo e salvar o histórico.
- Criar/editar dados locais e fazer exportação/importação.
- Consultar bulário com produto efetivamente constante no CSV do MAPA.
- Configurar OPENAI_API_KEY e enviar texto, foto, nota de áudio e vídeo curto ao Sebastião.
