// Anatomy converter: NIfTI CT + label masks → web region files (see docs/SPEC.md F1).
// The steps live in convertCore.ts. The usage check must keep working
// (tests/anatomy/convert-cli.test.ts).
//
// Run with: npm run anatomy:convert -- <input-folder> <output-folder>
import { runConvertCli } from './convertCore';

process.exitCode = runConvertCli(process.argv.slice(2));
