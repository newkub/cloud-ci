import {
  defineConfig,
  presetIcons,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({ scale: 1.15, warn: true }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      brand: {
        DEFAULT: '#f97316',
        dim: '#fb923c',
      },
      surface: {
        0: '#09090b',
        1: '#101013',
        2: '#18181c',
        3: '#232329',
      },
      line: '#27272e',
    },
  },
  shortcuts: {
    'card': 'bg-surface-1 border border-line rounded-xl',
    'input-chip': 'px-3 py-1.5 rounded-lg text-sm border border-line bg-surface-2 hover:bg-surface-3 transition-colors',
  },
});
