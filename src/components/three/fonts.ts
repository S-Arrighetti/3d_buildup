// Bundled so <Text> never falls back to troika's default, which fetches fonts
// from cdn.jsdelivr.net at runtime. Glyphs outside Latin (e.g. CJK cargo
// labels) still fall back to that CDN.
import regular from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import bold from '@fontsource/roboto/files/roboto-latin-700-normal.woff?url';

export const LABEL_FONT = regular;
export const LABEL_FONT_BOLD = bold;
