import { logger } from './logger';

const FONT_FILES = [
  { name: 'Inter', file: 'Inter-Regular.woff2', weight: 400 },
  { name: 'Inter', file: 'Inter-SemiBold.woff2', weight: 600 },
  { name: 'Inter', file: 'Inter-Bold.woff2', weight: 700 },
  { name: 'Noto Sans SC', file: 'NotoSansSC-Regular.woff2', weight: 400 },
  { name: 'Noto Sans SC', file: 'NotoSansSC-Bold.woff2', weight: 700 }
];

let fontsLoaded = false;

export const loadFonts = async (): Promise<void> => {
  if (fontsLoaded) {
    return;
  }

  try {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime) {
      logger.warn('Chrome runtime not available, cannot load fonts');
      return;
    }

    const fontFaces: FontFace[] = [];

    for (const { name, file, weight } of FONT_FILES) {
      try {
        const fontUrl = runtime.getURL(`src/assets/fonts/${file}`);
        const fontFace = new FontFace(name, `url(${fontUrl})`, { weight: String(weight) });

        await fontFace.load();
        document.fonts.add(fontFace);
        fontFaces.push(fontFace);

        logger.debug(`Loaded font: ${name} (${weight})`);
      } catch (error) {
        logger.warn(`Failed to load font: ${name} (${weight})`, error);
      }
    }

    if (document.fonts && 'ready' in document.fonts) {
      await document.fonts.ready;
    }

    fontsLoaded = true;
    logger.info(`Successfully loaded ${fontFaces.length} fonts`);
  } catch (error) {
    logger.error('Failed to load fonts', error);
  }
};

export const ensureFontsLoaded = async (): Promise<void> => {
  if (!fontsLoaded) {
    await loadFonts();
  }

  // Additional wait to ensure fonts are fully rendered
  if (document.fonts && 'ready' in document.fonts) {
    await document.fonts.ready;
  }
};
