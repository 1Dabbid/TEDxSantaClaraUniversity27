import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Inter for the generated share images. The OG renderer cannot read woff2, so
 * OTF copies live in this folder (SIL OFL, see LICENSE-Inter.txt). Read at
 * build time only.
 */
const fontFile = (name: string) => readFile(join(process.cwd(), 'src/app/_og', name));

export async function ogFonts() {
  const [regular, display] = await Promise.all([fontFile('Inter-Regular.otf'), fontFile('InterDisplay-SemiBold.otf')]);
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter Display', data: display, weight: 600 as const, style: 'normal' as const },
  ];
}
