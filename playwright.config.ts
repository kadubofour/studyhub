import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Its own server so the fake OpenAI never affects normal development (stop other `next dev` runs first)
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_FAKE_AI: '1', OPENAI_API_KEY: 'e2e-fake', OPENAI_BASE_URL: `http://localhost:${PORT}/api/test-openai/v1`,
      E2E_FAKE_PAYSTACK: '1', PAYSTACK_SECRET_KEY: 'sk_test_e2e', PAYSTACK_BASE_URL: `http://localhost:${PORT}/api/test-paystack`,
      PAYSTACK_PLAN_MONTHLY: 'PLN_e2e_monthly', PAYSTACK_PLAN_YEARLY: 'PLN_e2e_yearly', // billing UI turns on from these keys
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
