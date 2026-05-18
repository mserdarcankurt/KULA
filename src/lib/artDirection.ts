/**
 * ART_DIRECTION: The Visual "Soul" of KULA
 * ---------------------------------------
 * This object centralizes all aesthetic tokens. 
 * Instead of hardcoding colors or image URLs inside components, 
 * we reference them here. This makes it easy to change the entire 
 * "vibe" of the app from one single file.
 */
export const ART_DIRECTION = {
  theme: "Berlin Community, Analog, Warm, Grassroots",
  description: "Aesthetic focusing on local community, sharing, natural light, and neighborhood connectedness.",
  
  /**
   * FALLBACKS: Preventing the "Empty State" look.
   * If a user posts a "Need" or a "Share" without uploading a photo, 
   * the app uses these category-specific high-quality Unsplash images.
   * This ensures the feed always looks warm and professional.
   */
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

  /**
   * BACKGROUNDS & TEXTURES:
   * We use 'bg-stone-50' for a warm, paper-like feel.
   * The 'pattern' is a subtle SVG dot grid that gives the UI depth.
   */
  backgrounds: {
    primary: "bg-stone-50",
    pattern: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%239C92ac\" fill-opacity=\"0.05\" fill-rule=\"evenodd\"%3E%3Ccircle cx=\"3\" cy=\"3\" r=\"3\"/%3E%3Ccircle cx=\"13\" cy=\"13\" r=\"3\"/%3E%3C/g%3E%3C/svg%3E')",
    hero: "https://images.unsplash.com/photo-1525926577800-7a3ac1ba3200?q=80&w=2000&auto=format&fit=crop", // Warm neighborhood street
  },

  /**
   * AVATARS:
   * We use DiceBear to generate procedural avatars.
   * 'avataaars' for people, 'shapes' for organizations.
   * This means we don't need to host profile pictures for everyone initially.
   */
  avatars: {
    userStyle: "avataaars", // Clean, minimal SVG
    orgStyle: "shapes",     // Abstract shapes for orgs
    getAvatarUrl: (seed: string, isOrg: boolean = false) => {
      // Pick the style based on whether it's a person or an organization
      const style = isOrg ? ART_DIRECTION.avatars.orgStyle : ART_DIRECTION.avatars.userStyle;
      // Return a unique URL for that specific user (the seed ensures it stays the same for them)
      return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    }
  },

  /**
   * AI PROMPT GUIDELINES:
   * When we ask an AI to generate images for us, we append these rules 
   * to ensure the generated images match our "Berlin Analog" style.
   */
  promptGuidelines: `
    Style: Analog photography, warm tones, natural lighting, 35mm film aesthetic, candid, authentic, grass-roots, community-focused.
    Subject Matter: Diverse people, neighborhood streets (Berlin style), altbaus, bicycles, urban gardens, thrift store finds, DIY workshops.
    Avoid: Corporate stock photo vibes, over-polished 3D renders, cold lighting, studio setups.
  `
};

/**
 * getFallbackImage()
 * ------------------
 * A helper function that takes a category name (like "Food" or "Plants")
 * and returns the correct image URL from the object above.
 * If the category is missing or unknown, it defaults to the 'Community' image.
 */
export function getFallbackImage(category?: string): string {
  // If no category is provided, use the Default image
  if (!category) return ART_DIRECTION.fallbacks.Default;
  
  // Try to find the category in our list, otherwise use Default
  return (ART_DIRECTION.fallbacks as Record<string, string>)[category] || ART_DIRECTION.fallbacks.Default;
}
