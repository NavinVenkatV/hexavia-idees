import { expect, test } from '@playwright/test';
import { join } from 'node:path';

const fixture = join(import.meta.dirname, '../src/domain/__fixtures__/idees_test.csv');

test('parcours de Camille : importer, noter, écarter un doublon, sortir la shortlist', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText("Déposez ici l'export des idées")).toBeVisible();

  // Mauvais fichier : message clair
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await expect(page.getByRole('alert')).toContainText("n'est pas un export CSV");

  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('6 idées importées')).toBeVisible();

  // Filtre par direction
  await page.getByLabel('Direction').selectOption('R&D');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Effacer les filtres' }).first().click();

  // Proposition des notes
  await page.getByRole('button', { name: /Proposer les notes pour toutes les idées/ }).click();
  await expect(page.locator('tbody .badge-ai')).toHaveCount(6);

  // Correction d'une note puis validation
  await page.getByText('Capteurs de vibration sur les presses').click();
  await page.getByRole('radiogroup', { name: 'Impact' }).getByRole('radio', { name: '2' }).click();
  await expect(page.getByText(/Revenir à la proposition/)).toBeVisible();
  await page.getByRole('button', { name: /Valider/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 sur 6 validées')).toBeVisible();

  // Doublon
  await page.getByRole('tab', { name: /Doublons/ }).click();
  await page.getByRole('button', { name: 'Doublon : garder IDEA-001' }).click();
  await expect(page.getByText('Toutes les paires signalées ont été examinées')).toBeVisible();

  // Shortlist et export
  await page.getByRole('tab', { name: /Shortlist/ }).click();
  await expect(page.locator('.sl-item')).toHaveCount(5); // 6 idées - 1 doublon
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger pour Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/^shortlist-hexavia-.*\.csv$/);

  // Les données survivent à un rechargement
  await page.reload();
  await expect(page.locator('.sl-item')).toHaveCount(0); // onglet par défaut : idées
  await expect(page.getByText('1 sur 6 validées')).toBeVisible();
});
