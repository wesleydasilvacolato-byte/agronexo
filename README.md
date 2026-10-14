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

A modalidade gratuita do Gemini não oferece capacidade ilimitada; limites do Google são por projeto/modelo. O histórico do chat nesta versão fica no **navegador**, sem sincronização entre dispositivos. Para uso público ou comercial, implemente autenticação, limitação persistente de consumo, políticas de privacidade e backups.

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
