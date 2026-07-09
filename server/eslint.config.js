// Flat config (ESLint 9+). Strict-ish now; module boundary rules arrive with the first modules.
import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error', // SDD §31: no `any` without written justification
  },
});
