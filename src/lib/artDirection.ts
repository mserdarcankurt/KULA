export const ART_DIRECTION = {
  theme: "Berlin Community, Analog, Warm, Grassroots",
  description: "Aesthetic focusing on local community, sharing, natural light, and neighborhood connectedness.",
  
  // Default Unsplash search terms for when no image is provided
  // Uses Unsplash source API for relevant random images if needed
  fallbacks: {
    Service: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1000&auto=format&fit=crop", // People collaborating
    Equipment: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?q=80&w=1000&auto=format&fit=crop", // Tools
    Music: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1000&auto=format&fit=crop", // Instruments
    Food: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1000&auto=format&fit=crop", // Fresh baked goods
    Electronics: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1000&auto=format&fit=crop", // Vintage electronics
    Books: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1000&auto=format&fit=crop", // Stacked books
    Plants: "https://images.unsplash.com/photo-1466692476877-241c7b897984?q=80&w=1000&auto=format&fit=crop", // Greenery
    Home: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1000&auto=format&fit=crop", // Cozy interior
    Environment: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop", // Nature/parks
    Art: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1000&auto=format&fit=crop", // Painting/crafts
    Community: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop", // Gathering
    Events: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1000&auto=format&fit=crop", // Outdoor gathering
    Mobility: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?q=80&w=1000&auto=format&fit=crop", // Bicycles
    Education: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop", // Study group
    Support: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1000&auto=format&fit=crop", // Helping hands
    Furniture: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=1000&auto=format&fit=crop", // Chair
    Clothing: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?q=80&w=1000&auto=format&fit=crop", // Vintage clothes
    CircleInvite: "/Circle_invite.png", // Warm conceptual team/hands, placeholder since generation is out of quota
    Default: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop" // Community fallback
  },

  // Consistent background elements (patterns, gradients, textures)
  backgrounds: {
    primary: "bg-stone-50",
    pattern: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%239C92ac\" fill-opacity=\"0.05\" fill-rule=\"evenodd\"%3E%3Ccircle cx=\"3\" cy=\"3\" r=\"3\"/%3E%3Ccircle cx=\"13\" cy=\"13\" r=\"3\"/%3E%3C/g%3E%3C/svg%3E')",
    hero: "https://images.unsplash.com/photo-1525926577800-7a3ac1ba3200?q=80&w=2000&auto=format&fit=crop", // Warm neighborhood street
  },

  // Avatars - consistent dicebear style throughout the app
  avatars: {
    userStyle: "avataaars", // Clean, minimal SVG
    orgStyle: "shapes",     // Abstract shapes for orgs
    getAvatarUrl: (seed: string, isOrg: boolean = false) => {
      const style = isOrg ? ART_DIRECTION.avatars.orgStyle : ART_DIRECTION.avatars.userStyle;
      return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    }
  },

  // Base prompt instructions for AI-generated assets via generate_image skill
  promptGuidelines: `
    Style: Analog photography, warm tones, natural lighting, 35mm film aesthetic, candid, authentic, grass-roots, community-focused.
    Subject Matter: Diverse people, neighborhood streets (Berlin style), altbaus, bicycles, urban gardens, thrift store finds, DIY workshops.
    Avoid: Corporate stock photo vibes, over-polished 3D renders, cold lighting, studio setups.
  `
};

/**
 * Helper to get a fallback image for an item based on its category
 */
export function getFallbackImage(category?: string): string {
  if (!category) return ART_DIRECTION.fallbacks.Default;
  return (ART_DIRECTION.fallbacks as Record<string, string>)[category] || ART_DIRECTION.fallbacks.Default;
}
