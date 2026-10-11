/**
 * ts-jest compiles the TypeScript sources to CommonJS in memory for the test run only.
 * Nothing is emitted to disk, so the package staying `"type": "module"` for Next is unaffected.
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
export default {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    // mirrors the `@/*` path alias from tsconfig.json
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: {
                    module: 'CommonJS',
                    moduleResolution: 'node',
                    target: 'ES2023',
                    esModuleInterop: true,
                    isolatedModules: false,
                    verbatimModuleSyntax: false,
                },
            },
        ],
    },
};
