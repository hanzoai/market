/** Validated environment config — read once at startup */
export const env = {
  port: Number(process.env.PORT ?? 3001),

  // Hanzo Base (sidecar; pure IAM client — no local admin password)
  baseUrl: process.env.BASE_URL ?? 'http://localhost:8090',

  // MinIO / S3
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://minio.hanzo.svc:9000',
  s3AccessKey: process.env.S3_ACCESS_KEY ?? 'hanzo',
  s3SecretKey: process.env.S3_SECRET_KEY ?? '',
  s3Bucket: process.env.S3_BUCKET ?? 'hub-files',
  s3Region: process.env.S3_REGION ?? 'us-east-1',

  // Hanzo IAM (hanzo.id) — OIDC. Endpoint paths are the canonical ones
  // published by hanzo.id/.well-known/openid-configuration; do not invent
  // alternative paths.
  iamUrl: process.env.IAM_URL ?? 'https://hanzo.id',
  iamAuthorizeUrl:
    process.env.IAM_AUTHORIZE_URL ??
    `${process.env.IAM_URL ?? 'https://hanzo.id'}/v1/iam/oauth/authorize`,
  iamTokenUrl:
    process.env.IAM_TOKEN_URL ??
    `${process.env.IAM_URL ?? 'https://hanzo.id'}/v1/iam/oauth/token`,
  iamUserinfoUrl:
    process.env.IAM_USERINFO_URL ??
    `${process.env.IAM_URL ?? 'https://hanzo.id'}/v1/iam/oauth/userinfo`,
  iamClientId: process.env.IAM_CLIENT_ID ?? 'hanzo-bothub',
  iamClientSecret: process.env.IAM_CLIENT_SECRET ?? '',

  // OpenAI embeddings
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  embeddingDimensions: 1536,

  // External services
  githubToken: process.env.GITHUB_TOKEN ?? '',
  vtApiKey: process.env.VT_API_KEY ?? '',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? '',

  // Public URL
  publicUrl: process.env.PUBLIC_URL ?? 'https://hanzo.market',
  apiUrl: process.env.API_URL ?? 'https://hanzo.market/api',
} as const
