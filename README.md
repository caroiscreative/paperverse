# Paperverse

La ciencia real, servida para curiosos reales. Papers científicos indexados por OpenAlex, con traducción al español.

---

## Qué tenés acá

- **Feed en vivo**: papers de los últimos 60 días en 14 temas, ordenados por citas.
- **Búsqueda** por texto completo (autor, título, tema).
- **Detalle** con abstract original + Explicámelo (AI) + acceso al paper completo.
- **Referencias** y **Citado por** — al tocarlos, la pantalla principal se convierte en el buscador, filtrado por esos papers.
- **Papers similares** y **Próximos temas** al final de cada detalle.
- Todo guardado en `localStorage`: los temas que elegiste y las explicaciones que ya pediste.

---

## Stack

| Pieza                      | Por qué                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| React 18 + Vite + TS       | Bundle mínimo, dev server instantáneo, tipado fuerte.               |
| React Router 6             | Dos rutas: `/` (feed/search/cites/citedBy) y `/paper/:id`.          |
| OpenAlex                   | ~250M papers, gratis, sin auth. Polite pool con `mailto=`.           |
| Claude Haiku 4.5           | Explicámelo: traducción a prosa simple. Barato y rápido.            |
| Vercel Serverless (Edge)   | `/api/explain` protege la API key. Free tier alcanza sobrado.       |

Sin Tailwind: el design system trae todas las clases en `public/kit.css` y los tokens en `public/colors_and_type.css`.

---

## Desarrollo local

```bash
npm install
# Para que Explicámelo ande en local necesitás correr el proxy serverless:
npx vercel dev
# o solo el front (Explicámelo fallará con 404, todo lo demás anda):
npm run dev
```

Variables de entorno (archivo `.env.local` en la raíz):

```
# Para el SDK de OpenAlex (aparece en el User-Agent, sube la priority).
VITE_POLITE_MAILTO=tu-email@ejemplo.com

# Solo server-side. No lo pongas con VITE_ o queda expuesto en el bundle.
ANTHROPIC_API_KEY=sk-ant-...

# Caché compartida para Explicámelo (ver sección abajo). Opcionales: si no
# están seteadas, cada usuario paga su propia generación.
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Caché compartida de Explicámelo (Upstash Redis)

Explicámelo tiene **tres niveles de caché** para no gastar tokens en vano:

1. **localStorage del usuario** — si ya leíste este paper, es instantáneo.
2. **Redis compartido** (Upstash) — si cualquier otro usuario ya pidió la traducción, la servimos sin tocar Claude.
3. **Anthropic** — solo se llama si los dos niveles anteriores fallan. Cuando responde, guardamos el resultado en Redis para que nadie más pague por el mismo paper.

En régimen permanente, **solo el primer lector de cada paper en el mundo paga tokens**. Todos los siguientes son gratis.

**Setup (5 minutos):**

1. Andá a [upstash.com](https://upstash.com) y creá una cuenta (Google/GitHub login).
2. *Create Database* → Redis → elegí región cerca de tu Vercel (`us-east-1` es buena default).
3. Copiá `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` de la pestaña *REST API*.
4. Pegalos en Vercel (*Settings → Environment Variables*) o en tu `.env.local`.

**Free tier de Upstash:** 10.000 comandos por día, 256 MB de storage. Cada explicación cachea una sola vez (= 2 comandos: GET + SET). 10k/día alcanza para miles de papers únicos por día.

Si las variables no están seteadas, la función lo detecta y degrada a *solo tier 1 + 3* — sigue funcionando, pero cada usuario paga por separado.

**Debug:** la respuesta de `/api/explain` trae el header `x-pv-cache` con `hit` / `miss` / `skip`. Podés verlo en el devtools de Vercel o con `curl -i`.

**Invalidar toda la caché:** cambiá `CACHE_PREFIX` en `api/explain.ts` de `pv:explain:v1` a `v2`. Útil si actualizás el system prompt.

---

## Deploy en Vercel (recomendado, 5 minutos, gratis)

**Por qué Vercel y no otra cosa:**
- El feed es 100% front-end (llama OpenAlex desde el browser) → cualquier CDN sirve.
- Explicámelo necesita esconder `ANTHROPIC_API_KEY` → necesitás función serverless.
- Vercel une las dos cosas en un deploy con dos comandos. Netlify y Cloudflare Pages sirven también, pero Vercel trae hosting + funciones + dominio gratis + HTTPS sin configurar nada. Cloudflare Workers habría requerido otro proyecto aparte para la función.

### Pasos

1. **Subí el repo a GitHub** (si no está ya).
2. Entrá a [vercel.com](https://vercel.com) → *Add New* → *Project* → importá el repo.
3. Vercel detecta Vite solo. Dejá todo por defecto.
4. En *Environment Variables* agregá:
   - `ANTHROPIC_API_KEY` = tu key de Anthropic. **Production + Preview + Development**.
   - `VITE_POLITE_MAILTO` = tu email (para OpenAlex).
   - *(opcional)* `PV_ALLOWED_ORIGIN` = `https://paperverse.vercel.app` una vez que tengas dominio.
5. *Deploy*. En ~2 minutos tenés URL pública con HTTPS.

### Costos estimados (free tier)

| Servicio          | Límite free                                    | ¿Alcanza? |
| ----------------- | ---------------------------------------------- | --------- |
| Vercel Hobby      | 100 GB bandwidth, 100k function invocations/mes | Sobra para MVP. |
| OpenAlex          | 100k req/día con mailto                        | Cada vista del feed = 1 req. Aguanta miles de usuarios. |
| Anthropic Haiku   | ~$0.25/M input tokens                          | Un abstract ~500 tokens → ~$0.0001 por Explicámelo. Con cache de localStorage, casi nunca pegás dos veces al mismo paper. |

### Después del deploy

- Probá `/api/explain` con `curl -X POST https://<tu-dominio>/api/explain -d '{"paperId":"W1","title":"test","abstract":"test"}' -H 'Content-Type: application/json'`. Si devuelve 200, la key está bien cargada.
- En Vercel → *Analytics* podés ver cuántas veces llaman `/api/explain`. Si crece raro, bajá el rate limit en `api/explain.ts` (variable `LIMIT`).
- Si querés dominio propio: Vercel → *Domains* → apuntá el CNAME. Cert HTTPS se emite solo.

---

## Alternativa: Cloudflare Pages + Workers

Si preferís Cloudflare:
1. `npm run build` para generar `dist/`.
2. Pages → "Connect to Git" → mismo repo. Build command `npm run build`, output `dist`.
3. Para la función: creá un Worker separado con el mismo código de `api/explain.ts` (traducido del Web API de Vercel al de Cloudflare — es casi idéntico), y en el front cambiá la URL de `/api/explain` por la del worker.
4. Pegá `ANTHROPIC_API_KEY` en *Workers* → *Settings* → *Variables*.

Más pasos, misma experiencia final. Por eso recomiendo Vercel salvo que ya tengas el resto de tu infra en Cloudflare.

---

## Estructura

```
src/
  lib/
    topics.ts        — las 14 categorías (PRD O-02), orden canónico, mapping a OpenAlex
    openalex.ts      — cliente tipado (feed, search, paper, refs, citedBy, similar)
    abstract.ts      — reconstruye el inverted index de OpenAlex a texto plano
    explain.ts       — client-side cache + llamada a /api/explain
  components/
    Header.tsx       — branding + search bar
    TopicChip.tsx    — filtro lateral
    PaperCard.tsx    — full (feed) / compact (recomendaciones)
    HeroPaperCard.tsx, HeroBanner.tsx — el paper destacado de la semana
    Byline.tsx, CountryFlag.tsx, Icon.tsx, TopicIcon.tsx
  pages/
    Feed.tsx         — 4 modos según URL: feed / search / cites / citedBy
    PaperDetail.tsx  — abstract ↔ Explicámelo, refs, citedBy, similares, próximos temas
  App.tsx, main.tsx, index.css
api/
  explain.ts         — Vercel Edge Function con rate limit + CORS
public/
  colors_and_type.css, kit.css, assets/*.svg
```

---

## Roadmap corto

- [ ] Biblioteca personal (guardar papers) — la UI ya está en el design system.
- [ ] Bloque "Dato random" — el FAB + sheet del design system.
- [ ] Screen de onboarding (PRD O-02) — sólo UI, la lógica de selección ya persiste.
- [ ] i18n para inglés, si la demanda llega.
