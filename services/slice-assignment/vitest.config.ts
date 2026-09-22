import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // sliceAssigner.ts builds its Supabase client at module scope, so merely importing
    // it runs createClient() — which throws `supabaseUrl is required` on an undefined
    // env. These are placeholders that satisfy the constructor and are never dialled:
    // nothing under test makes a request.
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
  },
})
