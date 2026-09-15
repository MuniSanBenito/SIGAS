export function getExternalApiConfig(): { baseUrl: string; apiKey: string } {
  return {
    apiKey: process.env.EXTERNAL_API_KEY || '',
    baseUrl: process.env.EXTERNAL_API_BASE_URL || '',
  }
}
