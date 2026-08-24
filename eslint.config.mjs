import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Los textos de negocio (ES) usan comillas tipográficas en JSX ya
      // escapadas por React; la regla genera ruido sin valor aquí.
      'react/no-unescaped-entities': 'off',
      // `declare global { namespace JSX }` en la landing es la forma oficial
      // de augmentar IntrinsicsElements para web-components (iconify-icon).
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      // DEUDA TÉCNICA DOCUMENTADA (seguimiento: tipar componentes admin):
      // los casts `any` restantes viven solo en componentes cliente legacy
      // del panel (AnalyticsView, sync panels). El core de Payload
      // (collections/actions/api) está limpio a partir de esta PR.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Mismo origen: navegación interna del panel con <a> en componentes
      // legacy. Migrarlos a <Link> requiere probar cada vista del admin.
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'next-env.d.ts', 'src/payload-types.ts'],
  },
];

export default eslintConfig;
