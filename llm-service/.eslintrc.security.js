module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:security/recommended'
  ],
  plugins: [
    '@typescript-eslint',
    'security',
    'no-unsanitized'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Security-focused rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',

    // Prevent unsafe HTML operations
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',

    // TypeScript security rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // Prevent dangerous JavaScript patterns
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-with': 'error',

    // Require strict comparisons
    'eqeqeq': ['error', 'always'],
    'no-eq-null': 'error',

    // Prevent prototype pollution
    'no-prototype-builtins': 'error',

    // Require proper error handling
    'no-empty-catch': 'error',
    'no-throw-literal': 'error',

    // Prevent information disclosure
    'no-console': 'error',
    'no-debugger': 'error',
    'no-alert': 'error',

    // Custom security rules for this project
    'no-restricted-globals': [
      'error',
      {
        name: 'process',
        message: 'Use configuration module instead of direct process.env access'
      }
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="process"][callee.property.name="env"]',
        message: 'Use configuration module instead of direct process.env access'
      },
      {
        selector: 'MemberExpression[object.name="process"][property.name="env"]',
        message: 'Use configuration module instead of direct process.env access'
      },
      {
        selector: 'CallExpression[callee.name="eval"]',
        message: 'eval() is dangerous and should not be used'
      },
      {
        selector: 'NewExpression[callee.name="Function"]',
        message: 'Function constructor is dangerous and should not be used'
      },
      {
        selector: 'AssignmentExpression[left.property.name="innerHTML"]',
        message: 'innerHTML assignment can lead to XSS vulnerabilities'
      },
      {
        selector: 'AssignmentExpression[left.property.name="outerHTML"]',
        message: 'outerHTML assignment can lead to XSS vulnerabilities'
      }
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'child_process',
            message: 'Use controlled subprocess execution through security module'
          },
          {
            name: 'vm',
            message: 'VM module can be dangerous - use controlled execution environment'
          },
          {
            name: 'cluster',
            message: 'Use controlled cluster management through application framework'
          }
        ],
        patterns: [
          {
            group: ['**/node_modules/**'],
            message: 'Import from package name, not node_modules path'
          }
        ]
      }
    ],

    // Prevent SQL injection patterns
    'no-restricted-properties': [
      'error',
      {
        object: 'String',
        property: 'raw',
        message: 'String.raw can be used for SQL injection - use parameterized queries'
      }
    ],

    // Ensure proper async/await usage
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Prevent timing attacks
    'no-restricted-modules': [
      'error',
      {
        paths: [
          {
            name: 'crypto',
            importNames: ['timingSafeEqual'],
            message: 'Use crypto.timingSafeEqual for secure comparisons'
          }
        ]
      }
    ]
  },
  overrides: [
    {
      // Less strict rules for test files
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'security/detect-object-injection': 'warn'
      }
    },
    {
      // Configuration files
      files: ['**/*.config.js', '**/*.config.ts'],
      rules: {
        'no-restricted-globals': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true
      }
    }
  }
};