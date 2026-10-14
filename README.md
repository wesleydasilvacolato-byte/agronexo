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
