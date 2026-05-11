# Project Art Direction & Aesthetic

Whenever generating UI, producing CSS, or using the \`generate_image\` tool for this app, follow these core artistic constraints based on our centralized \`src/lib/artDirection.ts\`:

**Vibe & Aesthetic:**
- Analog, warm, grassroots, community-oriented.
- Berlin local neighborly vibe (Altbau apartments, DIY, street art, tempelhofer feld, urban gardens, vintage finds, bike fixing).
- Honest and unpolished rather than corporate or sterile.

**Color Palette Guidance:**
- Warm neutrals (stone, cream, warm gray).
- Earthy accents (emerald greens, warm terracotta, soft mustard yellows, muted purples).
- Avoid harsh, neon, or pure cyber/tech colors unless accenting.

**Imagery Rules:**
- Avoid generic 3D corporate renders (e.g., standard "tech illustrations").
- Use candid, natural-lit analog-style photography. 
- Use the fallback constants in \`/src/lib/artDirection.ts\` for empty states or default banners.
- When generating new images, append: "Style: Analog 35mm film photography, natural lighting, candid, authentic, grass-roots, community-focused, avoiding corporate stock styles."

**CSS/UI Architecture:**
- Soft, human rounded corners (\`rounded-2xl\`, \`rounded-3xl\`).
- Gentle, warm shadows (\`shadow-sm\`, soft offsets).
- Keep the UI structured but welcoming (bento grids, clean typography with Inter).

**Implementation:**
Whenever a component renders an \`Item\` (Ask, Share, Mission) without an image, it MUST dynamically read from \`getFallbackImage(item.category)\` from \`src/lib/artDirection.ts\` instead of a hardcoded grey screen or random placeholder.
