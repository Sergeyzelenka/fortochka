// ФОРТОЧКА · воркер-пайплайн.
// Запуск: npm run worker            — все шаги по очереди
//         npm run worker collect    — только сбор
// Каждый шаг идемпотентен: берёт записи в «своём» статусе и двигает дальше.
// Упавшая запись получает error_count+1 и будет повторена в следующем цикле;
// после MAX_ERRORS уходит в статус error с уведомлением главреду.

// ВАЖНО: грузим .env.local ДО импортов, которые читают process.env (lib/db и т.д.)
import { config } from 'dotenv';
config({ path: '.env.local' });

import { collect } from './steps/collect';
import { filterStep } from './steps/filter';
import { draftStep } from './steps/draft';
import { notifyAdmin } from '../lib/telegram';
import { isMock } from '../lib/db';

const steps: Record<string, () => Promise<void>> = {
  collect,
  filter: filterStep,
  draft: draftStep
};

async function main() {
  const only = process.argv[2];
  if (isMock) {
    console.log('⚠ Мок-режим: ключи Supabase не заданы. Заполни .env по образцу .env.example');
  }
  const list = only ? [only] : ['collect', 'filter', 'draft'];
  for (const name of list) {
    const fn = steps[name];
    if (!fn) {
      console.error(`Неизвестный шаг: ${name}. Доступны: ${Object.keys(steps).join(', ')}`);
      process.exit(1);
    }
    console.log(`\n=== Шаг: ${name} ===`);
    try {
      await fn();
    } catch (e: any) {
      console.error(`Шаг ${name} упал:`, e?.message ?? e);
      await notifyAdmin(`ФОРТОЧКА воркер: шаг ${name} упал — ${String(e?.message ?? e).slice(0, 300)}`);
    }
  }
  console.log('\nГотово.');
}

main();
