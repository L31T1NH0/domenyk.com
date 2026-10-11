# Teste de posicionamento político v0.1

Rota pública: `/quiz`. Menu: **Teste político**. API: `POST /api/quiz`.

## Núcleo e versionamento

- `src/lib/quiz/questions.ts`: 60 enunciados públicos, com IDs estáveis de 1 a 60.
- `src/lib/quiz/weights.server.ts`: matriz completa; cada linha corresponde ao mesmo índice de pergunta. Pesos omitidos são zero.
- `src/lib/quiz/calculate.server.ts`: validação, eixos, dimensões, cobertura, comparação de perfis e descrição determinística.
- `src/lib/quiz/consistency.ts`: pares relacionados, sinais e tolerâncias.
- `src/lib/quiz/ideologies.ts`: nove referências editoriais multidimensionais.
- `src/lib/quiz/types.ts`: polos e formato do resultado.

Os arquivos de pesos e perfis usam `server-only`; não são enviados no bundle do navegador. Diagnósticos (53–60) têm matriz vazia e não alteram eixos ou dimensões. Tradicionalismo, responsabilização por dano e premissas sobre status fetal não são convertidos automaticamente em autoridade.

Para cada eixo/dimensão: `10 × Σ(resposta / 3 × peso) / Σ|peso respondido|`. Somente números de −3 a +3 entram. Neutro é zero e conta no denominador. “Depende” e “Não sei” são excluídos; o primeiro também é contado como condicional. Sem pesos respondidos, o resultado é `null`, nunca um centro inventado.

Cobertura posicional é a porcentagem de respostas numéricas nas primeiras 52 perguntas. Cobertura por eixo é a fração da massa absoluta de pesos respondida. Cobertura diagnóstica considera separadamente as oito últimas perguntas. Esses indicadores medem disponibilidade de dados, não confiança estatística.

A proximidade ideológica usa distância quadrática média entre as dimensões observadas e os dois eixos, com importância igual para cada componente. Exige cobertura posicional ≥60% e cobertura ≥50% em cada eixo; caso contrário, mostra dados insuficientes. Distância superior a 4 pontos do perfil mais próximo produz “Híbrido”. As três referências mais próximas são exibidas sem porcentagens de identificação. Os limiares são hipóteses editoriais.

Consistência: média de penalidades dos pares respondidos, com pelo menos dois pares. A diferença é `|a − sinal × b|`, na escala 0–6. A penalidade é `max(0, diferença − tolerância)/(6 − tolerância)`. Os pares abstrato/concreto têm tolerância 3; respostas condicionais são excluídas. Não há inferência de erro ou mérito.

Simetria: média normalizada de 57, 58 (invertida) e 59, com pelo menos duas respostas numéricas. Valor 50 representa neutralidade, não apoio forte a regras simétricas. A medida é autorrelatada, não prova de comportamento institucional.

## Persistência e privacidade

O progresso e a fotografia completa do último resultado ficam em `localStorage`, sob `political-quiz:v0.1`. Ao reabrir, o resultado salvo é exibido sem recalcular; a edição das respostas exige novo cálculo. O download JSON inclui versão, respostas, eixos, dimensões, diagnósticos, perfis e data. Não há persistência de respostas no banco nem associação à conta. O servidor recebe as respostas para fazer o cálculo, mas a rota não as registra em logs. As ferramentas gerais de análise de visitas do site continuam presentes.

Ao alterar perguntas, pesos, perfis ou fórmulas após publicação, crie outra versão e outra chave de armazenamento. Não reinterprete resultados exportados de versões anteriores. Não existe migração automática de respostas entre versões.

## Validação antes de interpretar os resultados

Esta versão não é um instrumento psicométrico validado. A linguagem das perguntas, os pesos, perfis e tolerâncias precisam de revisão e calibração com participantes de posições conhecidas. Testar sobretudo perfis socialistas, liberais, conservadores, mistos e pessoas que separam moralidade de criminalização. Verificar equilíbrio temático, redundância, concentração dos pesos, interpretação dos enunciados e sensibilidade aos limiares. A dimensão RR tem uma base pequena de perguntas posicionais; ampliá-la numa próxima versão se a coleta mostrar baixa estabilidade.

Esta versão foi substituída pela v0.2. Resultados e perguntas antigas são preservados.
