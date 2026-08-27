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
          <p className="text-[17px] font-medium leading-relaxed text-neutral-950 dark:text-[#f1f1f1]">Antes deste site, já havia o nome Domenyk. E, muito antes do nome, havia uma mania minha: eu queria entender como as coisas funcionavam.</p>
          <p>Desde criança, desconfio de explicações que dão nome a um fenômeno e param por aí. Se alguém dizia que uma coisa era certa, necessária ou inevitável, eu procurava a exceção. Queria saber onde a regra deixava de valer e o que ainda faltava explicar.</p>
          <p>Continuo fazendo isso. Muitas discussões acabam cedo demais, logo depois de encontrar um culpado óbvio. Eu prefiro seguir até conseguir explicar quem fez o quê, por que agiu daquela maneira e como suas decisões produziram o resultado.</p>
          <p>Comecei a estudar política por volta dos 11 anos. Primeiro, fui atraído pelos discursos feminista e trabalhista. As intenções pareciam boas. A dificuldade surgiu quando tentei acompanhar as propostas até suas consequências. Algumas medidas apresentadas como proteção restringiam escolhas. Outras criavam incentivos para o resultado oposto ao que prometiam.</p>
          <p>Procurando respostas, conheci o conservadorismo e, ao estudar as ideias e instituições que o formaram, cheguei ao liberalismo. Isso não encerrou minhas dúvidas. Ficou uma cobrança que levo comigo: uma ideia também precisa ser julgada pelo que as pessoas fazem quando ela vira regra.</p>
          <p>A política, sozinha, não conseguia explicar essa distância entre intenção e resultado. Uma lei não executa a própria justificativa. Entre a proposta e o efeito aparecem pessoas tomando decisões, protegendo interesses, absorvendo custos e tentando se adaptar. Foi esse intervalo que me levou à economia.</p>
          <p>Com a economia, aprendi a prestar atenção à escassez, aos custos de oportunidade e aos incentivos. Toda escolha sacrifica uma alternativa. Uma medida pode beneficiar alguém de forma visível e espalhar a conta entre pessoas que nem participaram da decisão. Por isso, quando leio uma regra, quero saber que comportamento ela recompensa, quais escolhas elimina e como alguém tentará contorná-la.</p>
          <p>Cheguei à filosofia ao perceber que certas discussões pareciam ser sobre fatos, mas dependiam do sentido atribuído a palavras como liberdade, justiça, exploração, igualdade, violência e direito. Às vezes, a definição mudava no meio do argumento e levava a conclusão junto.</p>
          <p>O direito, a história e o estudo das instituições me ajudaram a entender como ideias se transformam em regras duradouras, como o poder é distribuído e por que sistemas parecidos produzem resultados diferentes. Meu interesse por tecnologia vem da mesma curiosidade. Diante de um programa, um sistema operacional, um site ou uma rede, quero localizar o mecanismo, descobrir por que ele falhou e saber o que precisa mudar.</p>
          <p>Hoje estudo política, economia, filosofia, urbanismo, história, literatura, programação e tecnologia pelo mesmo motivo. Cada área oferece uma forma de investigar sistemas, suas regras e as pessoas que agem dentro deles.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que orienta este site</h2>
          <p>Eu escrevo para entender quem decide, quem paga e o que acontece quando uma ideia sai do discurso e interfere na vida de alguém.</p>
          <p>Parto de uma tradição liberal, com ênfase na liberdade individual, na propriedade, na responsabilidade e na associação voluntária. Assumo essa premissa e continuo examinando cada caso. Preciso perguntar se houve agressão, fraude ou coerção, quem ganhou poder de escolha, quem o perdeu e onde o custo terminou.</p>
          <p>Também tento usar o mesmo critério quando ele favorece alguém de quem gosto e quando protege alguém que considero desprezível. Se eu mudo a regra para poupar aliados ou atingir adversários, estou apenas defendendo o meu grupo.</p>
          <p>Minhas posições não surgiram prontas nem permaneceram intactas. Já abandonei ideias e reformulei argumentos. Mudar de opinião não é uma derrota. A derrota seria conservar uma conclusão depois que suas premissas deixaram de se sustentar.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">Como abordo uma ideia</h2>
          <p>Costumo começar por algo concreto: uma notícia, uma proposta de lei, uma decisão judicial, um contrato, uma fala ou uma situação comum.</p>
          <p>Primeiro, tento entender o problema sem aceitar de saída a solução que veio anexada a ele. Depois acompanho o mecanismo. Observo o que muda, quem recebe poder, como as pessoas podem reagir, quais escolhas desaparecem e onde surgem os custos.</p>
          <p>Uma boa intenção explica por que uma proposta convence. Ela não prova o resultado. O problema pode ser real e ter recebido o diagnóstico errado. Também podemos confundir uma consequência com sua causa, tratar correlação como causalidade ou aliviar um sintoma enquanto fortalecemos o processo que o produziu.</p>
          <p>Boa parte do meu trabalho consiste em desfazer misturas desse tipo: problema e solução, causa e consequência, intenção e resultado, discordância e agressão, desigualdade e injustiça, direito e benefício, poder econômico e poder de coerção. A complexidade permanece, mas fica mais fácil apontar onde está a divergência.</p>
          <p>Esse cuidado vale para os argumentos com os quais concordo. Encontrar um culpado não basta. Chamar alguém de ganancioso, cruel, preconceituoso ou explorador pode ser um julgamento moral correto, mas ainda falta explicar por que aquele comportamento produziu determinado resultado naquele contexto.</p>
          <p>Procuro evitar abstrações que apagam os agentes. Frases como &quot;a sociedade escolheu&quot;, &quot;o mercado decidiu&quot;, &quot;as empresas fizeram&quot; ou &quot;o governo resolveu&quot; ficam incompletas enquanto não sabemos quem podia decidir, quem não podia impedir a decisão e quem recebeu as consequências.</p>
          <p>Valores fazem parte dos argumentos. O problema começa quando eles, as intenções, os rótulos ou as autoridades ocupam o lugar da explicação.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que você encontrará aqui</h2>
          <p>Este site reúne posts, notas e ideias em desenvolvimento.</p>
          <p>Os posts são textos mais completos. Neles, procuro delimitar o problema, definir os conceitos, identificar os agentes envolvidos, reconstruir o mecanismo e responder às principais objeções.</p>
          <p>As notas são mais imediatas. Podem registrar uma hipótese, uma distinção, uma reação ou o começo de um argumento. Nem toda ideia precisa estar encerrada para ser publicada. Algumas servem justamente para formular melhor a pergunta.</p>
          <p>O tamanho depende do que o argumento exige. Algumas ideias cabem em poucos parágrafos. Outras precisam de dados, referências, objeções e uma cadeia causal maior.</p>
          <p>Pesquisa, dados e autores aparecem como ferramentas, não como substitutos para o raciocínio. Podem sustentar uma premissa ou corrigir uma informação, mas ainda é necessário mostrar como se chega à conclusão.</p>
          <p>Você encontrará posições firmes, discordâncias duras e algum sarcasmo, mas também hipóteses, concessões e revisões. Não escrevo para representar integralmente um campo político. Cada argumento é uma responsabilidade própria.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">O que você não vai encontrar</h2>
          <p>Este site não é um catálogo de opiniões sobre tudo o que acontece. Nem toda notícia exige um posicionamento, e nem toda impressão merece ser publicada antes de ser examinada.</p>
          <p>Também não é um espaço de propaganda partidária ou de defesa automática de políticos, governos, empresas ou movimentos. Concordar com alguém em um caso não transforma essa pessoa em autoridade sobre os demais.</p>
          <p>Você também não encontrará rótulos usados como explicações completas.</p>
          <p>Dizer que alguma coisa acontece &quot;por causa do capitalismo&quot;, &quot;do Estado&quot;, &quot;da ganância&quot;, &quot;da desigualdade&quot;, &quot;da cultura&quot; ou &quot;da sociedade&quot; pode indicar uma hipótese. Não mostra como o resultado foi produzido.</p>

          <h2 className="pt-5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">Por que mantenho este espaço</h2>
          <p>Escrever é a forma que encontrei de organizar e testar minhas ideias. Uma explicação pode parecer perfeita enquanto está apenas na cabeça. No papel, as lacunas aparecem. Preciso definir os conceitos, expor as premissas e mostrar por que uma afirmação conduz à seguinte.</p>
          <p>Durante muito tempo, essas ideias ficaram espalhadas por conversas, anotações e perguntas. Criei o site para reuni-las.</p>
          <p>Domenyk é um arquivo público do que estudo, penso e crio. Ele registra conclusões, mas guarda também mudanças, erros e conexões que só aparecem com o tempo. A coerência que procuro está em deixar claro o princípio usado, aceitar suas consequências e corrigir o argumento quando ele falha.</p>
          <p>Não espero concordância em cada texto. Quero que o leitor consiga identificar a pergunta, acompanhar o mecanismo e comparar a explicação com a realidade. Uma regra pode parecer boa até perguntarmos quem terá o poder de aplicá-la e onde a conta vai parar. Com os princípios acontece algo parecido: o teste fica mais difícil quando eles protegem um adversário.</p>
        </div>
      </article>
      <div id="about-content-boundary" />
      <BackHome boundaryId="about-content-boundary" label="Voltar para a página inicial" />
    </>
  )
}
