export interface HairColor {
  id: string; // kebab-case, unique, e.g. "level-6-copper"
  displayName: string; // e.g. "Dark Copper Blonde"
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; // depth, 1=black .. 10=lightest blonde
  family:
    | 'natural'
    | 'ash'
    | 'gold'
    | 'copper'
    | 'red'
    | 'violet'
    | 'mahogany'
    | 'fashion';
  temperature: 'cool' | 'neutral' | 'warm';
  targetLab: { l: number; a: number; b: number }; // CIELAB, D65
  opacity: number; // 0..1, how strongly it covers
  highlightRetention: number; // 0..1, how much original luminance survives
  minimumRecommendedStartingLevel?: number; // 1..10
}

export interface Hairstyle {
  id: string; // kebab-case, unique
  name: string;
  assets: {
    front: string;
    leftThreeQuarter?: string;
    rightThreeQuarter?: string;
    /**
     * Try-on overlay anchor (Iteration 5 / M6), normalized (0..1) in the
     * overlay art's own coordinate space: where the wearer's face-skin
     * region should sit under this style's overlay art. Present only for
     * "art-bearing" styles (currently the 6 MVP styles registered in
     * `src/overlays/registry.ts`) — its presence here is what the UI uses
     * to decide whether a style is try-on-eligible ("art coming soon"
     * otherwise). See `src/catalog/__tests__/catalog.test.ts` for the
     * integrity check cross-referencing this against the overlay registry.
     */
    headBox?: { x: number; y: number; w: number; h: number };
  };
  lengths: ('buzzed' | 'short' | 'chin' | 'shoulder' | 'medium' | 'long')[];
  fringe: (
    | 'none'
    | 'blunt-bangs'
    | 'wispy-bangs'
    | 'curtain-bangs'
    | 'side-swept'
  )[];
  textures: ('straight' | 'wavy' | 'curly' | 'coily')[];
  attributes: string[]; // free-form tags, e.g. "bob", "layered"
}
