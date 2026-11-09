// Anatomy converter: NIfTI CT + label masks → web region files (see docs/SPEC.md F1).
// F0 placeholder: F1 replaces the conversion part. The usage check below must
// keep working after F1 (tests/anatomy/convert-cli.test.ts).
//
// Run with: npm run anatomy:convert -- <input-folder> <output-folder>

const USAGE = 'Usage: npm run anatomy:convert -- <input-folder> <output-folder>';

function main(args: readonly string[]): number {
  const [inputFolder, outputFolder] = args;
  if (!inputFolder || !outputFolder) {
    console.error(USAGE);
    return 1;
  }
  console.error('Anatomy conversion is not built yet (it comes in feature F1).');
  return 1;
}

process.exitCode = main(process.argv.slice(2));
