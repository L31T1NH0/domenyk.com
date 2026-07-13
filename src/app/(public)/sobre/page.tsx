import type { Metadata } from "next"
import { BackHome } from "@/components/BackHome"
import { Header } from "@/components/Header"
import { absoluteUrl, buildPageMetadata, jsonLd, siteConfig } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Sobre Domenyk: política, economia e liberalismo",
  description: "Conheça Domenyk, autor de um blog independente sobre política, economia, liberalismo, filosofia, instituições e tecnologia, com foco em causalidade, incentivos e consequências.",
  path: "/sobre",
})

export default function AboutPage() {
  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "ProfilePage",
                "@id": `${absoluteUrl("/sobre")}#profile`,
                url: absoluteUrl("/sobre"),
                name: "Sobre Domenyk",
                description: "Domenyk é autor de um blog independente sobre política, economia, liberalismo, filosofia, instituições e tecnologia.",
                mainEntity: { "@id": `${siteConfig.url}/#person` },
                inLanguage: "pt-BR",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: "Sobre", item: absoluteUrl("/sobre") },
                ],
              },
            ],
          }),
        }}
      />
      <article className="border-y border-neutral-200 py-6 dark:border-white/10">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">Sobre mim</h1>
        <div className="mt-5 flex max-w-[68ch] flex-col gap-4 text-pretty text-[15px] leading-relaxed text-neutral-800 [&_em]:text-neutral-700 [&_em]:dark:text-zinc-300 [&_strong]:font-semibold [&_strong]:text-neutral-950 [&_strong]:dark:text-white dark:text-zinc-200">
          <p className="text-[17px] font-medium leading-relaxed text-neutral-950 dark:text-[#f1f1f1]">Domenyk surgiu antes do site.</p>
          <p>Desde criança, tenho dificuldade de aceitar explicações que <em>apenas dão nome a um fenômeno</em>, mas não mostram <strong>como ele aconteceu</strong>. Quando alguma coisa era apresentada como certa, necessária ou inevitável, minha reação era procurar onde a regra deixava de valer, qual era a exceção e o que ainda não havia sido explicado.</p>
          <p>Muitas discussões terminam cedo demais. O problema recebe um nome, encontra-se um culpado óbvio e a investigação para ali. Mas uma explicação que serve para tudo normalmente explica muito pouco.</p>
          <p><strong>Não me basta saber que algo aconteceu.</strong> Quero entender quem fez o quê, por que agiu daquela maneira e como suas decisões produziram o resultado observado.</p>
          <p>Comecei a estudar política por volta dos 11 anos. Na época, fui seduzido pelos discursos feminista e trabalhista. As intenções pareciam boas, mas, quando eu tentava acompanhar suas consequências práticas, encontrava contradições: medidas apresentadas como proteção frequentemente restringiam escolhas ou incentivavam o resultado oposto ao prometido.</p>
          <p>Isso me levou a estudar mais profundamente. Primeiro conheci o conservadorismo. Depois, ao investigar as ideias e instituições que o haviam moldado, encontrei o liberalismo.</p>
          <p>Não foi apenas uma mudança de rótulo. Foi o começo de uma preocupação que permanece até hoje: <strong>não julgar uma ideia apenas pelo problema que denuncia ou pela intenção que anuncia, mas pelo que acontece quando ela é aplicada.</strong></p>
          <p>Com o tempo, percebi que a política, isoladamente, explica pouco. Uma lei não executa automaticamente aquilo que aparece em sua justificativa. Entre uma proposta e seu resultado existem pessoas tomando decisões, reagindo às novas regras, tentando se adaptar e buscando proteger os próprios interesses.</p>
          <p>Foi essa distância entre <em>intenção</em> e <em>resultado</em> que me levou à economia.</p>
          <p>A economia me ensinou que toda decisão acontece sob limitações. Recursos são escassos, escolhas sacrificam alternativas e pessoas reagem aos benefícios e prejuízos associados a cada ação. Uma medida pode favorecer alguém de forma visível e, ao mesmo tempo, espalhar seus custos entre pessoas que sequer participaram da decisão.</p>
          <p>Foi também aí que passei a prestar mais atenção aos <strong>incentivos</strong>, aos <strong>custos de oportunidade</strong> e aos <strong>efeitos indiretos</strong>. Não basta perguntar o que uma regra ordena. É preciso perguntar que comportamento ela recompensa, que alternativas elimina e como as pessoas podem tentar contorná-la.</p>
          <p>A filosofia entrou por outro caminho. Muitas discussões pareciam discordar sobre os fatos, quando na verdade utilizavam as mesmas palavras com sentidos diferentes. Liberdade, justiça, exploração, igualdade, violência e direito podem mudar de significado no meio de um argumento sem que essa mudança seja percebida.</p>
          <p>O direito, a história e o estudo das instituições ajudaram a mostrar como ideias se transformam em regras duradouras, como o poder é distribuído e por que sistemas semelhantes podem produzir resultados diferentes em contextos distintos.</p>
          <p>Meu interesse por tecnologia nasceu da mesma curiosidade. Um programa, um sistema operacional, um site ou uma rede também são sistemas formados por regras, limitações e decisões. Quando algo funciona, quero entender o mecanismo. Quando falha, quero localizar o problema e descobrir o que precisa ser alterado.</p>
          <p>Por isso, meus interesses não são tão separados quanto parecem. Política, economia, filosofia, urbanismo, história, literatura, programação e tecnologia são maneiras diferentes de investigar sistemas: como são construídos, quem pode agir dentro deles e quais consequências suas regras produzem.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que orienta este site</h2>
          <p>Eu escrevo para entender <strong>quem decide, quem paga e o que acontece depois</strong> que uma ideia sai do discurso e passa a interferir na vida de pessoas reais.</p>
          <p>Os assuntos mudam, mas algumas perguntas permanecem: houve agressão, fraude ou coerção? Quem ganhou poder de escolha e quem perdeu? Que comportamento uma regra recompensa? O custo ficou com quem tomou a decisão ou foi transferido para outra pessoa?</p>
          <p>Meu ponto de partida é liberal, com ênfase na <strong>liberdade individual</strong>, na <strong>propriedade</strong>, na <strong>responsabilidade</strong> e na <strong>associação voluntária</strong>. Não escondo essa premissa sob uma aparência de neutralidade, mas também não a utilizo como resposta automática para todos os casos.</p>
          <p><strong>Um princípio que só vale contra adversários é apenas um instrumento de facção.</strong> Por isso, procuro aplicar o mesmo critério quando ele favorece alguém de quem gosto e quando protege alguém que considero desprezível.</p>
          <p>Também não trato rótulos como explicações. Dizer que algo é capitalista, socialista, democrático, autoritário, público ou privado não mostra como aquilo funciona. É preciso olhar para as regras, os incentivos, o poder de decisão, as alternativas disponíveis e a distribuição dos custos.</p>
          <p>Minhas posições não surgiram prontas nem permaneceram intactas. Já abandonei ideias e reformulei argumentos. <strong>Mudar de opinião não é uma derrota.</strong> A derrota seria conservar uma conclusão depois que suas premissas deixaram de se sustentar.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">Como abordo uma ideia</h2>
          <p>Costumo partir de algo concreto: uma notícia, uma proposta de lei, uma decisão judicial, um contrato, uma fala ou uma situação comum.</p>
          <p>O primeiro passo é entender o problema. O segundo é separar esse problema da solução proposta. O terceiro é acompanhar o mecanismo: o que muda, quem ganha poder, como as pessoas podem reagir, quais escolhas desaparecem e onde os custos tendem a surgir.</p>
          <p>Reconhecer um problema não torna qualquer resposta legítima ou eficaz. <strong>A intenção explica por que uma proposta convence; não prova que ela produzirá o resultado prometido.</strong></p>
          <p>Por isso, muitos dos meus textos não rejeitam a observação inicial. Eles questionam a conclusão construída sobre ela. Um problema pode ser real e ter sido diagnosticado incorretamente. Uma consequência pode ser confundida com sua causa. Uma correlação pode ser tratada como causalidade. Uma solução pode aliviar o sintoma enquanto fortalece o processo que o produziu.</p>
          <p>Procuro, assim, separar coisas que frequentemente aparecem misturadas: <em>problema e solução</em>, <em>causa e consequência</em>, <em>intenção e resultado</em>, <em>discordância e agressão</em>, <em>desigualdade e injustiça</em>, <em>direito e benefício</em>, <em>poder econômico e poder de coerção</em>.</p>
          <p>O objetivo não é tornar simples aquilo que é complexo. É mostrar exatamente onde está a dificuldade.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que você encontrará aqui</h2>
          <p>Este site reúne posts, notas e ideias em desenvolvimento.</p>
          <p>Os posts são textos mais completos. Neles, procuro delimitar o problema, definir os conceitos, identificar os agentes envolvidos, reconstruir o mecanismo e responder às principais objeções.</p>
          <p>As notas são mais imediatas. Podem registrar uma hipótese, uma distinção, uma reação ou o começo de um argumento. Nem toda ideia precisa estar encerrada para ser publicada; algumas servem justamente para formular melhor a pergunta.</p>
          <p>O tamanho depende do que o argumento exige. Algumas ideias cabem em poucos parágrafos. Outras precisam de dados, referências, objeções e uma cadeia causal maior.</p>
          <p>Pesquisa, dados e autores aparecem como <strong>ferramentas, não como substitutos para o raciocínio</strong>. Podem sustentar uma premissa ou corrigir uma informação, mas ainda é necessário mostrar como se chega à conclusão.</p>
          <p>Você encontrará posições firmes, discordâncias duras e algum sarcasmo, mas também hipóteses, concessões e revisões. Não escrevo para representar integralmente um campo político. Cada argumento é uma responsabilidade própria.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que você não vai encontrar</h2>
          <p>Este site não é um catálogo de opiniões sobre tudo o que acontece. Nem toda notícia exige um posicionamento, e nem toda impressão merece ser publicada antes de ser examinada.</p>
          <p>Também não é um espaço de propaganda partidária ou de defesa automática de políticos, governos, empresas ou movimentos. Concordar com alguém em um caso não transforma essa pessoa em autoridade sobre os demais.</p>
          <p>Você também não encontrará rótulos usados como explicações completas.</p>
          <p>Dizer que alguma coisa acontece “por causa do capitalismo”, “do Estado”, “da ganância”, “da desigualdade”, “da cultura” ou “da sociedade” pode indicar uma hipótese. Não mostra como o resultado foi produzido.</p>
          <p className="my-2 text-center text-base font-semibold tracking-tight text-neutral-950 dark:text-white"><span className="underline decoration-neutral-400 decoration-2 underline-offset-4 dark:decoration-zinc-600">Um nome não é um mecanismo.</span></p>
          <p>Uma explicação precisa identificar quem agiu, sob quais regras, buscando qual resultado e por qual cadeia de efeitos sua decisão produziu aquilo que está sendo analisado.</p>
          <p>Encontrar um culpado também não encerra a investigação. Chamar alguém de ganancioso, cruel, preconceituoso ou explorador pode ser um julgamento moral correto, mas não explica por que esse comportamento produziu determinado resultado naquele contexto e não em outro.</p>
          <p>Da mesma forma, identificar um problema não demonstra a solução. Entre o diagnóstico e o remédio existem incentivos, reações, custos, alternativas perdidas e efeitos indiretos. Ignorar essa passagem não prova que a proposta seja falsa, mas mostra que ela ainda não foi demonstrada.</p>
          <p>Você também não encontrará intenções tratadas como resultados. Chamar uma medida de proteção, inclusão, valorização ou justiça não garante que ela cumpra o que promete. Políticas são executadas por pessoas dentro de instituições, não pelos nomes que recebem.</p>
          <p>Referências também não serão usadas para encerrar discussões. Evidências, fontes e conhecimento especializado importam, mas não eliminam a necessidade de demonstrar a ligação entre as premissas e a conclusão.</p>
          <p>Por fim, procuro evitar abstrações que apagam quem realmente agiu. “A sociedade escolheu”, “o mercado decidiu”, “as empresas fizeram” e “o governo resolveu” são afirmações incompletas enquanto não sabemos quem podia decidir, quem não podia impedir a decisão e quem ficou com suas consequências.</p>
          <p>O objetivo não é retirar os valores dos argumentos. É impedir que <strong>valores, intenções, rótulos e autoridades ocupem o lugar da explicação</strong>.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">Por que manter este espaço</h2>
          <p><strong>Escrever é a maneira que encontrei de organizar e testar minhas ideias.</strong></p>
          <p>Uma explicação pode parecer perfeita enquanto permanece apenas na mente. Quando é colocada em palavras, suas lacunas aparecem. Escrever me obriga a definir conceitos, expor premissas e mostrar como uma afirmação conduz à seguinte.</p>
          <p>Durante muito tempo, minhas ideias existiram como conversas, anotações e perguntas espalhadas. O site surgiu para reuni-las.</p>
          <p><strong>Domenyk é um arquivo público de ideias em desenvolvimento:</strong> um mapa daquilo que estudo, penso e crio. Ele registra conclusões, mas também mudanças, erros e conexões que só se tornam visíveis com o tempo.</p>
          <p>A coerência que me interessa não exige preservar todas as opiniões que já expressei. Exige deixar claro o princípio utilizado, aceitar suas consequências e corrigir o argumento quando ele falha.</p>
          <p>Não espero que o leitor concorde com tudo. Espero que cada texto formule melhor uma pergunta, revele um mecanismo antes escondido ou apresente uma explicação que possa ser comparada com a realidade.</p>
          <p>Se uma regra parece boa, vale perguntar quem terá o poder de aplicá-la. Se um benefício parece gratuito, vale procurar quem ficou com a conta. E, se um princípio parece óbvio quando atinge o outro lado, seu verdadeiro teste começa quando ele protege nosso adversário.</p>
          <p className="pt-2"><em>Ideias não iluminam a escuridão por serem confortáveis, populares ou pronunciadas por alguma autoridade.</em></p>
          <p className="text-base font-semibold text-neutral-950 dark:text-white">Elas iluminam quando nos ajudam a enxergar aquilo que antes não conseguíamos ver.</p>
        </div>
      </article>
      <div id="about-content-boundary" />
      <BackHome boundaryId="about-content-boundary" label="Voltar para a página inicial" />
    </>
  )
}
