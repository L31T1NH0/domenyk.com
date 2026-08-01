import { MongoClient } from "mongodb"

const apply = process.argv.includes("--apply")
const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not set")

const coverAltBySlug = {
  "justica-social-e-liberdade": "Ilustração de um punho erguido diante de um círculo vermelho sobre fundo azul-escuro.",
  dissociacao: "Porta entreaberta deixa um feixe de luz entrar em um ambiente escuro.",
  "airbnb-e-o-stj": "Chave dourada centralizada sobre fundo preto.",
  "mercado-negro-nao-e-errado": "Mão com luva branca entrega um pequeno pacote a outra mão sobre fundo preto.",
  "37-anos-de-silencio-sobre-tiananmen": "Ilustração de um homem com sacolas diante de uma coluna de tanques, em referência ao Homem dos Tanques.",
  "o-esquecimento-do-henry": "Cadeira infantil colorida vazia diante da bancada de um tribunal.",
  "preconceito-e-crime": "Ilustração de uma mão recusando o aperto oferecido por outra pessoa.",
}

const translatedCoverAltBySlug = {
  "mercado-negro-nao-e-errado": {
    id: "Tangan bersarung putih menyerahkan paket kecil kepada tangan lain dengan latar hitam.",
  },
  "casamento-lgbt-contratos-privados-e-o-estado": {
    en: "Two men kiss in silhouette while a bureaucrat in a red suit watches in the background.",
    id: "Dua pria berciuman dalam siluet sementara seorang birokrat berjas merah mengamati dari latar belakang.",
  },
}

const airbnbBodyImageUrl = "https://x4ceaxoe9soax6vc.public.blob.vercel-storage.com/media/Screenshot_20260510-170346-d3yRRkNQs4dbco7f8Wv8QWDf74oPYF.jpg"
const airbnbBodyImageAlt = "Montagem com quarto de hospedagem, logotipo do Airbnb e texto sobre decisão do STJ que exige autorização de dois terços do condomínio."

const client = new MongoClient(uri)
try {
  await client.connect()
  const posts = client.db("blog").collection("posts")
  const changes = []

  for (const [slug, alt] of Object.entries(coverAltBySlug)) {
    const post = await posts.findOne({ slug }, { projection: { title: 1, "cover.alt": 1 } })
    if (!post) throw new Error(`Post não encontrado: ${slug}`)
    if (post.cover?.alt === alt) continue
    if (post.cover?.alt?.trim() && post.cover.alt.trim() !== post.title.trim()) {
      throw new Error(`Texto alternativo já personalizado em ${slug}; atualização interrompida.`)
    }

    changes.push({ slug, field: "cover.alt", before: post.cover?.alt ?? null, after: alt })
    if (apply) {
      await posts.updateOne(
        { _id: post._id, "cover.alt": post.cover?.alt },
        { $set: { "cover.alt": alt, updatedAt: new Date() } }
      )
    }
  }

  for (const [slug, translations] of Object.entries(translatedCoverAltBySlug)) {
    const post = await posts.findOne({ slug }, { projection: { translations: 1 } })
    if (!post) throw new Error(`Post não encontrado: ${slug}`)

    for (const [locale, alt] of Object.entries(translations)) {
      const translation = post.translations?.[locale]
      if (!translation?.published) throw new Error(`Tradução publicada não encontrada: ${slug}:${locale}`)
      if (translation.coverAlt === alt) continue
      if (translation.coverAlt?.trim()) {
        throw new Error(`Texto alternativo traduzido já personalizado em ${slug}:${locale}; atualização interrompida.`)
      }

      changes.push({ slug: `${slug}:${locale}`, field: "coverAlt", before: translation.coverAlt ?? null, after: alt })
      if (apply) {
        await posts.updateOne(
          { _id: post._id, [`translations.${locale}.coverAlt`]: translation.coverAlt ?? null },
          { $set: { [`translations.${locale}.coverAlt`]: alt, [`translations.${locale}.updatedAt`]: new Date(), updatedAt: new Date() } }
        )
      }
    }
  }

  const airbnb = await posts.findOne({ slug: "airbnb-e-o-stj" }, { projection: { content: 1 } })
  if (!airbnb) throw new Error("Post não encontrado: airbnb-e-o-stj")
  const emptyAirbnbImage = `![](${airbnbBodyImageUrl})`
  const describedAirbnbImage = `![${airbnbBodyImageAlt}](${airbnbBodyImageUrl})`
  if (airbnb.content.includes(emptyAirbnbImage)) {
    changes.push({ slug: "airbnb-e-o-stj", field: "content.image.alt", before: "", after: airbnbBodyImageAlt })
    if (apply) {
      const now = new Date()
      await posts.updateOne(
        { _id: airbnb._id, content: airbnb.content },
        {
          $set: {
            content: airbnb.content.replace(emptyAirbnbImage, describedAirbnbImage),
            originalContentUpdatedAt: now,
            updatedAt: now,
          },
        }
      )
    }
  } else if (!airbnb.content.includes(describedAirbnbImage)) {
    throw new Error("A imagem sem descrição do post airbnb-e-o-stj não corresponde ao conteúdo esperado.")
  }

  const marketPost = await posts.findOne(
    { slug: "mercado-negro-nao-e-errado" },
    { projection: { originalContentUpdatedAt: 1, updatedAt: 1, "translations.id": 1 } }
  )
  if (!marketPost?.translations?.id) throw new Error("Tradução indonésia não encontrada: mercado-negro-nao-e-errado")
  const sourceUpdatedAt = marketPost.originalContentUpdatedAt ?? marketPost.updatedAt
  const indonesianTags = ["pasar gelap", "pengendalian harga", "kelangkaan", "pelarangan", "penyelundupan"]
  const translationIsCurrent = new Date(marketPost.translations.id.sourceUpdatedAt).getTime() >= new Date(sourceUpdatedAt).getTime()
  const tagsAreCurrent = JSON.stringify(marketPost.translations.id.tags ?? []) === JSON.stringify(indonesianTags)
  if (!translationIsCurrent || !tagsAreCurrent) {
    changes.push({
      slug: "mercado-negro-nao-e-errado:id",
      field: "translation discovery metadata",
      before: { tags: marketPost.translations.id.tags ?? [], sourceUpdatedAt: marketPost.translations.id.sourceUpdatedAt },
      after: { tags: indonesianTags, sourceUpdatedAt },
    })
    if (apply) {
      const now = new Date()
      await posts.updateOne(
        { _id: marketPost._id, "translations.id.updatedAt": marketPost.translations.id.updatedAt },
        {
          $set: {
            "translations.id.tags": indonesianTags,
            "translations.id.sourceUpdatedAt": sourceUpdatedAt,
            "translations.id.updatedAt": now,
            updatedAt: now,
          },
        }
      )
    }
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", changes: changes.length, details: changes }, null, 2))
} finally {
  await client.close()
}
