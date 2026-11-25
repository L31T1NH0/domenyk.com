# Netflix → Assistindo agora

Extensão Manifest V3 para Brave e outros navegadores Chromium. Lê os metadados
do player e envia o estado para o backend **Go**, como o Music Go. Não usa Trakt,
cookies, credenciais da Netflix nem histórico de navegação.

## Instalação no Brave

1. Na raiz de `domenyk.com`, rode:

   ```sh
   node extensions/netflix/setup.mjs
   ```

2. Cadastre o hash impresso como `WATCHING_DEVICE_TOKEN_SHA256` no ambiente do
   **domenyk-api** e publique a API Go com as novas rotas. O token original fica
   em `extensions/netflix/config.json`, ignorado pelo Git, com permissão `0600`.
   Rodar o setup novamente preserva o token. Não compartilhe essa pasta com o
   arquivo privado incluído.
3. Abra `brave://extensions`, ative **Modo do desenvolvedor**, escolha
   **Carregar sem compactação** e selecione esta pasta (`extensions/netflix`).
4. Recarregue a aba da Netflix e comece um episódio. O ícone da extensão mostra
   `ON` após um envio bem-sucedido, `...` enquanto aguarda os metadados do vídeo
   e `!` em caso de erro. Clicar no ícone abre
   `https://domenyk.com/links`.
5. Publique o site com o novo card. Ele consulta `/api/links/watching`, que lê
   `GET /v1/watching` na mesma origem Go já configurada para a música.

Se a proteção da Vercel bloquear a API, adicione `protectionBypass` ao JSON
privado com o valor de Protection Bypass for Automation **do projeto da API**,
como no Music Go. Recarregue a extensão após mudar a configuração. O segredo
nunca é enviado em URLs, ao site público ou aos scripts de conteúdo da Netflix.

## Comportamento

- Heartbeat a cada 15 segundos e envio ao mudar o estado do player. Um alarme
  do worker verifica as abas a cada 30 segundos enquanto a Netflix estiver
  aberta, inclusive quando os timers da página pausada forem limitados pelo Brave.
- Título, episódio, capa disponível e link Netflix sem parâmetros de rastreamento.
  Quando o player não fornece capa, a API Go consulta o TVmaze e guarda o ID da
  série e a URL da capa por 24 horas. Não exige chave adicional. A identificação
  aceita somente um título correspondente; nomes ambíguos ou títulos traduzidos
  que não correspondam ao catálogo ficam sem essa capa complementar.
- Pausar mantém “Assistindo agora” enquanto o episódio estiver aberto. Ao
  terminar, sair do player ou fechar a aba, envia parada. Em falhas de
  rede, a API expira o status após 45 segundos; o próximo heartbeat recupera o envio.
  Esse comportamento e o alarme de presença estão disponíveis desde a versão 1.2.0.
- Sessão aleatória e sequência crescente sobrevivem à suspensão do worker.
  Paradas de outra aba não encerram a sessão atual. Havendo duas reproduções,
  o sinal mais recente de reprodução assume o status público.
- O card fica oculto sem reprodução atual. Não há histórico público ou ranking.
- Desde a versão 1.1.0, o worker consulta o player no contexto da própria página
  (`MAIN`) com a permissão `scripting`. Busca somente os metadados do vídeo atual
  na Netflix, com fallback para os controles e Media Session. Não depende de os
  controles estarem visíveis. A consulta usa a sessão normal da aba, que permanece
  na Netflix: cookies e credenciais não são lidos nem enviados ao backend Go.
  Os metadados do catálogo podem estar em inglês. Sem título confiável,
  não publica; sem capa no player ou no catálogo, mostra um ícone. Mudanças no DOM da Netflix podem exigir
  atualizar `player.mjs` ou `detector.js`. Recarregar a extensão reconecta as abas
  Netflix já abertas. Reinjeções substituem o leitor anterior, sem duplicar os
  heartbeats. A nova versão pode pedir que você aceite a permissão `scripting`
  e `alarms` ao recarregar em `brave://extensions`.

## Desenvolvimento local

```sh
node extensions/netflix/setup.mjs http://localhost:8080
```

Configure o hash na API Go local e use `GO_ADMIN_API_URL=http://localhost:8080`
no site. As únicas origens de API permitidas são produção e localhost:8080.
Para revogar a extensão, remova/troque `WATCHING_DEVICE_TOKEN_SHA256` na API.
Para girar o token, mova o config privado para fora da pasta, rode novamente o
setup e substitua o hash na API. Desativar a extensão interrompe os heartbeats.

Referências da plataforma:
- [Requisições pelo worker e permissões de origem](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Armazenamento restrito a contextos confiáveis](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Execução no contexto do player](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [TVmaze: API e licença CC BY-SA](https://www.tvmaze.com/api). O crédito também
  aparece na página “Sobre” do site. Falhas do catálogo preservam a última capa
  encontrada e recebem nova tentativa após cinco minutos.
