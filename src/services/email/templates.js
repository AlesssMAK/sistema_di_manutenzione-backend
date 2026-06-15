import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';

const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'templates',
);

const compiledCache = new Map();

export const renderTemplate = async (templateName, context) => {
  let compiled = compiledCache.get(templateName);
  if (!compiled) {
    const filePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    const source = await fs.readFile(filePath, 'utf8');
    compiled = Handlebars.compile(source, { noEscape: false });
    compiledCache.set(templateName, compiled);
  }
  return compiled(context);
};

export const clearTemplateCache = () => compiledCache.clear();
