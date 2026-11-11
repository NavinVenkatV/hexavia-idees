/**
 * Génère les captures du README à partir d'un export CSV.
 * Usage : npm run build && npm run preview & ; npx tsx scripts/screenshots.ts chemin/vers/idees.csv
 */
import { chromium } from '@playwright/test';

const csv = process.argv[2];
const out = process.argv[3] ?? 'docs';
if (!csv) throw new Error('Usage : screenshots.ts <fichier.csv> [dossier]');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, locale: 'fr-FR' });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/0-import.png` });
await page.locator('input[type=file]').setInputFiles(csv);
await page.getByRole('button', { name: /Proposer les notes/ }).click();
await page.waitForSelector('text=Proposition des notes', { state: 'detached' });
await page.getByRole('button', { name: 'Masquer' }).click().catch(() => {});
await page.waitForSelector('.toast', { state: 'detached', timeout: 8000 }).catch(() => {});
await page.screenshot({ path: `${out}/1-idees.png` });
await page.locator('tbody tr').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/2-notation.png` });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: /^2\. Doublons/ }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/3-doublons.png` });
await page.getByRole('button', { name: /^3\. Shortlist/ }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/4-shortlist.png` });
await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: `${out}/5-impression.png`, fullPage: true });
await browser.close();
