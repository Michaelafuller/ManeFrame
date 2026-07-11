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
