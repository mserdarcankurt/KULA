# Project Art Direction & Aesthetic

Whenever generating UI, producing CSS, or using the `generate_image` tool for this app, follow these core artistic constraints based on our centralized `src/lib/artDirection.ts`:

**Vibe & Aesthetic:**
- **Core Philosophy**: Grounded in global, ancient traditions of unconditional giving, mutual aid, and trust networks where people give and share without expecting a direct return.
- **Cultural Inspiration**:
  - *İmece (Turkey)*: Voluntary collective village labor for the common good (e.g. harvesting, building roofs).
  - *Xenia (Ancient Greece)*: Sacred guest-friendship and hospitality protected by Zeus Xenios (welcoming travelers unconditionally).
  - *Ayni (Andean Mountains)*: Sacred reciprocity and spiritual balance between neighbors ("Today for you, tomorrow for me").
  - *Kula (Papua)*: Ceremonial circle of gift exchange to build trust and prestige.
  - *Ubuntu (Southern Africa)*: Communitarian connection ("I am because we are").
  - *Gotong Royong (Southeast Asia)*: Shared carrying of community burdens.
- **Visual Expression**: A warm local neighborly expression (Altbau apartments, DIY backyards, street art, urban gardens, vintage finds, bike fixing) blended with raw, human-made textures representing human touch across cultures.
- **Tone**: Honest, warm, and unpolished rather than corporate, transactional, or sterile.

**Color Palette Guidance:**
- **Base Neutrals**: Warm earthy tones representing clay, sand, paper, and raw textiles (stone, cream, warm gray, oatmeal linen, terracotta).
- **Earthy Accents**: Deep organic indigo (traditional dyes), emerald/sage greens (nature and sprouts), soft mustard/ochre yellows (harvest and grain), muted purples.
- **Avoid**: Harsh, neon, or pure cyber/tech colors unless accenting.

**Imagery Rules:**
- Avoid generic 3D corporate renders (e.g., standard "tech illustrations").
- Use candid, natural-lit analog-style photography. 
- Use the fallback constants in `/src/lib/artDirection.ts` for empty states or default banners.
- When generating new images, append: "Style: Analog 35mm film photography, organic textures (clay, textiles, wood), natural golden hour lighting, candid, authentic, grass-roots, community-focused, avoiding corporate stock styles."

**CSS/UI Architecture:**
- Soft, human rounded corners (`rounded-2xl`, `rounded-3xl`).
- Gentle, warm shadows (`shadow-sm`, soft offsets).
- Keep the UI structured but welcoming (bento grids, clean typography with Inter).

**Implementation:**
Whenever a component renders an `Item` (Ask, Share, Mission) without an image, it MUST dynamically read from `getFallbackImage(item.category)` from `src/lib/artDirection.ts` instead of a hardcoded grey screen or random placeholder.
