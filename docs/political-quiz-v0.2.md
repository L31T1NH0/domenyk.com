# Teste de posicionamento político v0.2

Página: `/quiz`. A versão v0.2 usa `schema_version: 2`. Perguntas e pesos são associados a IDs fixos em `src/lib/quiz/questions.ts` e `src/lib/quiz/weights.server.ts`. Reordenar as perguntas não altera a resposta nem os pesos correspondentes.

As perguntas foram reescritas em frases diretas, com uma ideia por vez e ponto de interrogação. A matriz preserva 52 perguntas posicionais e oito diagnósticas. As respostas continuam sendo −3 a +3, “Neutro”, “Depende” ou “Não sei”.

Perfis comparam dimensões pelo erro quadrático médio ponderado. Para cada dimensão, a confiabilidade é a cobertura da soma absoluta dos pesos respondidos multiplicada pelo suporte efetivo de perguntas: `n_efetivo = (Σ|peso|)² / Σ(peso²)`. O suporte chega a 100% em quatro perguntas efetivas e é arredondado a seis casas. Perguntas sem resposta numérica não contam. Os eixos recebem confiabilidade pela cobertura e pelo mesmo limite de suporte. Esses números servem somente para ponderar a distância; não são probabilidades nem validade psicométrica.

Pesos em `src/lib/quiz/ideologies.ts` são protótipos editoriais. Uma regra institucional ou uma posição moral não move automaticamente o eixo de liberdades civis. A revisão removeu esse efeito de controle constitucional, políticas locais, currículo nacional e costume familiar, entre outros enunciados. Aborto e status do feto seguem perguntas separadas.

Os resultados `v0.1` continuam sob a antiga chave `political-quiz:v0.1`. O navegador os oferece para download e inicia uma nova versão sem migrar ou recalcular respostas antigas. A nova chave é `political-quiz:v0.2:schema-2`. O endpoint rejeita modelo ou esquema diferentes.

A matriz completa e auditável está em [`political-quiz-v0.2-weights.csv`](political-quiz-v0.2-weights.csv). Fontes de escrita consultadas na wiki: `wiki/analises-editoriais/guia-de-escrita-e-humanizacao-de-textos-politicos-na-voz-do-autor.md`, `wiki/analises-editoriais/perfil-profundo-do-pensamento-e-da-escrita-do-autor.md`, `wiki/distincao-entre-valores-pessoais-e-coercao-institucional.md` e os textos sobre salário, contratos, preconceito e crime. A wiki orienta clareza e distinções, sem tratar posição do autor como gabarito ideológico.
