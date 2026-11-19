// First-party open-source agents, platform tools, MCP servers, and connectors.
// Every item links to its open-source GitHub repository so developers can
// inspect, fork, contribute pull requests, or publish their own variant on
// hanzo.market and earn x402 revenue share on every call or job.

import type { CapabilitySpec, Kind, McpListing, Reputation, Shop, ShopListing } from '~/lib/market'

/** No settled job, review or install: the directory's entries are not shop listings. */
const ZERO_REP: Reputation = {
  rating: null,
  reviews: 0,
  installs: 0,
  jobs: { completed: 0, disputed: 0 },
}

const CREATED = 1790737083
const KAI_MMBERT_REP = '17e3cf68617d2bf5915b6d88513c8a1ca89eb82069a3159b3eb22e3d0bf65b6c'
const KAI_BASE_SHA = 'e8b1234a90d817c6e452f0198a3b74c56d1209e8f34a7b61c290d8e4f5a123b0'

function capabilityListing(
  tool: string,
  title: string,
  category: string,
  description: string,
  spec: Pick<CapabilitySpec, 'sha256' | 'form' | 'questionKey' | 'questionType' | 'labels' | 'repairs' | 'damage' | 'latencyUs'> &
    Partial<Pick<CapabilitySpec, 'rank' | 'bytes' | 'fireRate' | 'specificity' | 'license'>>,
): ShopListing {
  const id = `lst_cap_${tool}`
  const docs = 'https://docs.hanzo.ai/docs/capabilities'
  return {
    id,
    publisherOrg: 'hanzo',
    kind: 'capability',
    tool,
    title,
    description,
    category,
    price: '0',
    currency: 'USD',
    public: true,
    docs,
    createdAt: CREATED,
    updatedAt: CREATED,
    seller: { org: 'hanzo', documented: true, reputation: ZERO_REP },
    reputation: ZERO_REP,
    capability: {
      baseSha256: KAI_BASE_SHA,
      representation: KAI_MMBERT_REP,
      rank: spec.rank ?? 0,
      bytes: spec.bytes ?? 18432,
      fireRate: spec.fireRate ?? 1.0,
      specificity: spec.specificity ?? 1.0,
      oodMoved: 0,
      license: spec.license ?? 'Apache-2.0',
      ...spec,
    },
    links: {
      docs,
      cli: `hanzo marketplace install --tool ${tool}`,
      mcp: { tool: 'marketplace', op: 'post_marketplace_install' },
    },
  }
}

function agentListing(
  tool: string,
  title: string,
  category: string,
  description: string,
  docs = `https://github.com/hanzoai/agents/tree/main/agents/${tool}`,
  id = `lst_agent_${tool}`,
): ShopListing {
  return {
    id,
    publisherOrg: 'hanzo',
    kind: 'agent',
    tool,
    title,
    description,
    category,
    price: '0',
    currency: 'USD',
    public: true,
    docs,
    createdAt: CREATED,
    updatedAt: CREATED,
    seller: { org: 'hanzo', documented: false, reputation: ZERO_REP },
    reputation: ZERO_REP,
    links: {
      docs,
      cli: `hanzo agent run ${tool} --prompt "<task>"`,
      mcp: { tool: 'agent', op: `run_${tool}` },
    },
  }
}

function toolListing(
  tool: string,
  title: string,
  category: string,
  price: string,
  description: string,
  docs = `https://github.com/hanzoai/mcp/tree/main/tools/${tool}`,
): ShopListing {
  const id = `lst_tool_${tool}`
  return {
    id,
    publisherOrg: 'hanzo',
    kind: 'tool',
    tool,
    title,
    description,
    category,
    price,
    currency: 'USD',
    public: true,
    docs,
    createdAt: CREATED,
    updatedAt: CREATED,
    seller: { org: 'hanzo', documented: false, reputation: ZERO_REP },
    reputation: ZERO_REP,
    links: {
      docs,
      cli: `hanzo tool call ${tool} --input '{}'`,
      mcp: { tool, op: 'call' },
    },
  }
}

export const DEFAULT_LISTINGS: readonly ShopListing[] = [
  // Core 8 Hanzo Team Agents (with canonical IDs matching api.hanzo.ai when present)
  agentListing(
    'dev',
    'Dev — Principal Software Engineer',
    'Engineering',
    'Full-stack software engineer agent. Reads whole repositories, plans multi-file refactors, runs test suites in an isolated sandbox, and opens clean pull requests.',
    'https://github.com/hanzoai/personas/blob/main/team/dev.md',
    'lst_659a85bc04eb13da',
  ),
  agentListing(
    'vi',
    'Vi — Staff Systems & Infra Engineer',
    'Engineering',
    'Distributed systems, Rust/Go/TypeScript architecture, database query tuning, and zero-downtime production debugging.',
    'https://github.com/hanzoai/personas/blob/main/team/vi.md',
    'lst_fbf85a1f127fd73f',
  ),
  agentListing(
    'des',
    'Des — Principal Product Designer',
    'Design',
    'Design systems, responsive UI architecture, accessibility audits, tokens, motion, and high-craft interfaces built on @hanzo/ui.',
    'https://github.com/hanzoai/personas/blob/main/team/des.md',
    'lst_d390cb6686e36894',
  ),
  agentListing(
    'feynman',
    'Feynman — First-Principles Physicist & Explainer',
    'Research',
    'Strips jargon away, tests every hypothesis against physical and mathematical reality, and explains complex mechanisms from first principles.',
    'https://github.com/hanzoai/personas/blob/main/team/feynman.md',
    'lst_e434af9ede07ff25',
  ),
  agentListing(
    'einstein',
    'Einstein — Deep Theoretical & Model Architect',
    'Research',
    'Thought-experiment driven researcher for frontier ML architectures, mathematical proofs, invariant discovery, and long-horizon reasoning.',
    'https://github.com/hanzoai/personas/blob/main/team/einstein.md',
    'lst_bace181c14aff340',
  ),
  agentListing(
    'nora',
    'Nora — Chief of Staff & Operations',
    'Operations',
    'Coordinates cross-functional programs, triages inbox and Slack threads, drafts executive briefs, and keeps milestones moving on schedule.',
    'https://github.com/hanzoai/personas/blob/main/team/nora.md',
    'lst_34d517eaf02abdab',
  ),
  agentListing(
    'maya',
    'Maya — Growth, Brand & Product Marketing',
    'Growth',
    'Positioning, launch copy, conversion funnels, SEO architecture, developer advocacy, and data-backed growth campaigns.',
    'https://github.com/hanzoai/personas/blob/main/team/maya.md',
    'lst_75beaa2922f05537',
  ),
  agentListing(
    'leo',
    'Leo — Finance, Strategy & Deal Desk',
    'Finance',
    'Unit economics, financial modeling, enterprise pricing, treasury allocation, x402 settlement accounting, and investor memos.',
    'https://github.com/hanzoai/personas/blob/main/team/leo.md',
    'lst_c98adde758b82010',
  ),
  // Additional Default Open-Source Specialist Agents
  agentListing(
    'sec',
    'Sec — Security & Smart-Contract Auditor',
    'Security',
    'Static and dynamic vulnerability analysis, dependency supply-chain auditing, IAM/KMS policy verification, and EVM/Solidity security review.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'ops',
    'Ops — Kubernetes, Cloud & SRE Agent',
    'Infrastructure',
    'Monitors Hanzo PaaS, Kubernetes clusters, Docker builds, Prometheus/OpenTelemetry alerts, and automated incident remediation.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'qa',
    'QA — Playwright & End-to-End Verification Agent',
    'Engineering',
    'Writes and runs browser-based Playwright e2e gates, visual regression checks, API contract tests, and accessibility audits.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'data',
    'Data — SQL, Warehouse & Vector Pipeline Agent',
    'Data',
    'Designs schemas, writes optimized PostgreSQL/ClickHouse/BigQuery queries, builds RAG embedding pipelines, and synthesizes analytics dashboards.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'arch',
    'Arch — Principal Systems & API Architect',
    'Engineering',
    'Reviews RFCs, designs clean module boundaries, OpenAPI/gRPC contracts, event-driven topologies, and multi-region cloud deployments.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'web3',
    'Web3 — Lux, EVM & x402 Protocol Engineer',
    'Web3',
    'Builds and audits smart contracts, MPC wallet integrations, cross-chain bridges, and x402 autonomous micropayment flows.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'research',
    'Research — Literature, Benchmarks & Synthesis Agent',
    'Research',
    'Searches arXiv, GitHub, and live documentation to produce cited technical surveys, competitive matrices, and reproducible eval benchmarks.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'support',
    'Support — Developer Relations & Triage Agent',
    'Support',
    'Answers SDK/API questions with runnable code examples, reproduces bug reports, links docs.hanzo.ai pages, and routes escalations.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'legal',
    'Legal — Open-Source Licensing, Compliance & Tax Agent',
    'Compliance',
    'Reviews Apache-2.0/MIT license obligations, W-9/W-8BEN tax workflows, DPA/SOC2 checklists, and commercial terms.',
    'https://github.com/hanzoai/agents',
  ),
  agentListing(
    'growth',
    'Growth — Analytics, Attribution & Lifecycle Agent',
    'Growth',
    'Instruments @hanzo/event funnels, analyzes cohort retention, optimizes onboarding flows, and automates outbound developer campaigns.',
    'https://github.com/hanzoai/agents',
  ),

  // Default Platform Tools (kind: 'tool', callable via MCP, CLI, or x402)
  toolListing(
    'hanzo_dev',
    'hanzo_dev — Autonomous Coding & PR Sandbox',
    'Developer tools',
    '0',
    'Spawns an isolated cloud worktree with full AST search, file editing, shell test execution, and automated GitHub pull-request creation.',
    'https://github.com/hanzoai/dev',
  ),
  toolListing(
    'hanzo_search',
    'hanzo_search — Hybrid Web & Code Meta-Search',
    'Search',
    '0.001',
    'Low-latency SearXNG + neural re-ranked web, news, academic paper, and repository search returning clean markdown and verified citations.',
    'https://github.com/hanzoai/search',
  ),
  toolListing(
    'hanzo_sql',
    'hanzo_sql — Managed PostgreSQL & Warehouse Query Tool',
    'Data',
    '0.001',
    'Executes parameterized read/write SQL queries, schema migrations, and explain-plan diagnostics against org databases.',
    'https://github.com/hanzoai/sql',
  ),
  toolListing(
    'hanzo_vector',
    'hanzo_vector — High-Dimensional Embedding & Hybrid Recall',
    'Data',
    '0.0005',
    'Indexes documents and code into Hanzo Vector and runs sub-10ms dense + BM25 hybrid retrieval with metadata filtering.',
    'https://github.com/hanzoai/vector',
  ),
  toolListing(
    'hanzo_browser',
    'hanzo_browser — Headless Chromium & Visual DOM Tool',
    'Automation',
    '0.005',
    'Navigates live web pages, captures high-DPI screenshots, inspects accessibility trees, and executes Playwright interactions in a cloud browser.',
    'https://github.com/hanzoai/operative',
  ),
  toolListing(
    'hanzo_exec',
    'hanzo_exec — Sandboxed Container Code Runner',
    'Compute',
    '0.002',
    'Runs Python, TypeScript/Bun, Rust, Go, or bash scripts inside an ephemeral micro-VM with deterministic artifact capture.',
    'https://github.com/hanzoai/mcp',
  ),
  toolListing(
    'hanzo_git',
    'hanzo_git — Repository, Branch, Diff & PR Tool',
    'Developer tools',
    '0',
    'Clones repos, inspects commit history, computes semantic diffs, manages worktrees, and opens or reviews pull requests.',
    'https://github.com/hanzoai/mcp',
  ),
  toolListing(
    'hanzo_deploy',
    'hanzo_deploy — Zero-Downtime Container & Static Deploy',
    'Infrastructure',
    '0',
    'Builds and deploys apps, static sites, and MCP servers to Hanzo PaaS with automatic TLS, custom domains, and instant rollbacks.',
    'https://github.com/hanzoai/paas',
  ),
  toolListing(
    'hanzo_kms',
    'hanzo_kms — Hardware-Backed Secrets & Envelope Encryption',
    'Security',
    '0',
    'Reads and rotates scoped environment secrets, API keys, and cryptographic signing keys from Hanzo KMS (`kms.hanzo.ai`).',
    'https://github.com/hanzoai/kms',
  ),
  toolListing(
    'hanzo_iam',
    'hanzo_iam — Identity, OIDC & RBAC Policy Tool',
    'Security',
    '0',
    'Verifies JWT/session principals, organization memberships, OAuth2 provider bindings, and fine-grained permission grants.',
    'https://github.com/hanzoai/iam',
  ),
  toolListing(
    'hanzo_vision',
    'hanzo_vision — Multimodal UI, Screenshot & Document OCR',
    'Multimodal',
    '0.002',
    'Extracts structured JSON, tables, layout coordinates, and design tokens from screenshots, diagrams, and PDF documents.',
    'https://github.com/hanzoai/mcp',
  ),
  toolListing(
    'hanzo_audio',
    'hanzo_audio — Realtime Transcription & Voice Synthesis',
    'Multimodal',
    '0.003',
    'Transcribes speech streams with speaker diarization and synthesizes natural low-latency voice output via Hanzo Voice.',
    'https://github.com/hanzoai/mcp',
  ),
  capabilityListing(
    'kai-tool-relevance',
    'kai-tool-relevance — MCP Tool Selection & Relevance Adapter',
    'Routing',
    'Scores and selects relevant MCP tools from a user prompt over the frozen Kai mmBERT 307M shared representation with zero OOD drift.',
    {
      sha256: '4a9f0c812e1d58c3b972f4019c86a3102b7e65d91847f6e201a5c3948b7162d3',
      form: 'adapter',
      questionKey: 'tool_relevance',
      questionType: 'choice',
      labels: ['relevant', 'irrelevant'],
      repairs: 142,
      damage: 0,
      latencyUs: 8,
    },
  ),
  capabilityListing(
    'jailbreak-400',
    'jailbreak-400 — Prompt Injection & Jailbreak Guard Adapter',
    'Safety',
    'Detects adversarial prompt injections, system-prompt extraction attempts, and jailbreaks in a single encoder pass.',
    {
      sha256: '7c82d41e9a0b35f6281c47e90d3a52b18f6e4092c17d8a35b649e01f2d73c8a4',
      form: 'adapter',
      questionKey: 'guardrails_jailbreak',
      questionType: 'choice',
      labels: ['safe', 'jailbreak'],
      repairs: 394,
      damage: 0,
      latencyUs: 6,
    },
  ),
  capabilityListing(
    'toxicchat-guard',
    'toxicchat-guard — Conversational Toxicity & Policy Reader (Kai 1.13)',
    'Safety',
    'Calibrated conversational toxicity and policy-violation reader trained on real-world user-assistant dialogues (live Rust F1 0.7874 vs Jev 0.7862).',
    {
      sha256: 'ae37acf17a2a92db6f7d39720b9bf817f9b4e3a7a3b3eef39e80d59f40117a87',
      form: 'reader',
      questionKey: 'toxic',
      questionType: 'noul',
      labels: ['benign', 'toxic'],
      repairs: 218,
      damage: 0,
      latencyUs: 12,
    },
  ),
  capabilityListing(
    'stsb-spearman',
    'stsb-spearman — Semantic Textual Similarity Reader (Kai 1.13)',
    'Ranking',
    'Continuous semantic equivalence and paraphrase similarity reader trained with Spearman rank-correlation supervision (live Rust Spearman 0.890214 vs Jev 0.890162).',
    {
      sha256: '08deef13955b72e5c154b6d774e386cd5e6a8c45fb4856b8a70b986b7705bf40',
      form: 'reader',
      questionKey: 'answer',
      questionType: 'score',
      labels: [],
      repairs: 185,
      damage: 0,
      latencyUs: 11,
    },
  ),
  capabilityListing(
    'prompt-injection-guard',
    'prompt-injection-guard — Adversarial Prompt Injection Adapter (Kai 1.13)',
    'Safety',
    'Detects direct and indirect prompt-injection attacks in user inputs and retrieved context (90.52% accuracy vs Jev 74.14%).',
    {
      sha256: 'bf4922a2b778a6d57ef6fe415ad61b6d5165c441ab156f8f2a2f74d6a9706192',
      form: 'adapter',
      questionKey: 'answer',
      questionType: 'noul',
      labels: ['legitimate', 'injection'],
      repairs: 94,
      damage: 0,
      latencyUs: 6,
    },
  ),
  capabilityListing(
    'language-id-200',
    'language-id-200 — 200-Language Identification Reader (Kai 1.13)',
    'Multilingual',
    'High-precision language identification reader across 200 languages over Kai mmBERT 307M (99.85% accuracy vs Jev 99.64%).',
    {
      sha256: 'e3985df7a31445496029ba82393f2e7cd283c226a304430e79293b742ae2b71a',
      form: 'reader',
      questionKey: 'answer',
      questionType: 'choice',
      labels: ['en', 'zh', 'es', 'de', 'fr', 'ar', 'hi', 'ja', 'ru', 'pt'],
      repairs: 312,
      damage: 0,
      latencyUs: 10,
    },
  ),
  capabilityListing(
    'paws-paraphrase',
    'paws-paraphrase — Adversarial Paraphrase Verification Reader (Kai 1.13)',
    'Reasoning',
    'Distinguishes true semantic paraphrases from high-lexical-overlap adversarial non-paraphrases on PAWS (90.28% accuracy vs Jev 84.99%).',
    {
      sha256: '430ebccc50b0d838234fe6f95924059a30a40fc8412ec21d9875537503a00ef7',
      form: 'reader',
      questionKey: 'answer',
      questionType: 'noul',
      labels: ['different', 'paraphrase'],
      repairs: 423,
      damage: 0,
      latencyUs: 12,
    },
  ),
  capabilityListing(
    'financial-phrasebank',
    'financial-phrasebank — Financial Sentiment & Earnings Polarity Adapter (Kai 1.13)',
    'Finance',
    'Classifies financial news, earnings call statements, and analyst commentary into positive, neutral, or negative sentiment (80.41% accuracy vs Jev 72.99%).',
    {
      sha256: '15755c5850c7678d70a4dbc2780f9dabab675b942905ac9f6fa723dd546f8423',
      form: 'adapter',
      questionKey: 'answer',
      questionType: 'choice',
      labels: ['negative', 'neutral', 'positive'],
      repairs: 72,
      damage: 0,
      latencyUs: 6,
    },
  ),
  capabilityListing(
    'clinc150-intent',
    'clinc150-intent — 150-Class Conversational Intent & OOS Router (Kai 1.13)',
    'Routing',
    'Routes user utterances across 150 banking, travel, utility, and enterprise intents plus out-of-scope detection (91.71% accuracy vs Jev 89.45%).',
    {
      sha256: 'ab26bfbcd3df14a51424ba5f217b35fb7da08186b0475122ba53d9f4ed8d0e3f',
      form: 'adapter',
      questionKey: 'answer',
      questionType: 'choice',
      labels: ['transfer', 'balance', 'freeze_account', 'oos'],
      repairs: 164,
      damage: 0,
      latencyUs: 8,
    },
  ),
  capabilityListing(
    'sms-spam-filter',
    'sms-spam-filter — Mobile & Messaging Spam Guard Adapter (Kai 1.13)',
    'Safety',
    'Filters SMS, messaging, and notification spam with calibrated precision/recall (F1 0.9409 vs Jev 0.9381).',
    {
      sha256: '9faed2e06045000353bf674ba7e4a7e51372d0763218d757851f53c95bddc6c8',
      form: 'adapter',
      questionKey: 'answer',
      questionType: 'noul',
      labels: ['ham', 'spam'],
      repairs: 89,
      damage: 0,
      latencyUs: 6,
    },
  ),
  capabilityListing(
    'unfair-tos-legal',
    'unfair-tos-legal — Unfair Terms-of-Service Clause Detector (Kai 1.13)',
    'Legal',
    'Detects potentially unfair consumer contract clauses including unilateral termination, liability limitation, and mandatory arbitration (micro-F1 0.5596 vs Jev 0.4993).',
    {
      sha256: 'c26a51945f4b4617e77c411b56b22e09c12ae0a7051f3445e7b8da95ea67eb90',
      form: 'adapter',
      questionKey: 'limitation_of_liability',
      questionType: 'noul',
      labels: ['fair', 'unfair'],
      repairs: 112,
      damage: 0,
      latencyUs: 7,
    },
  ),
  capabilityListing(
    'agb-de-clauses',
    'agb-de-clauses — German Consumer Contract (AGB) Clause Adapter (Kai 1.13)',
    'Legal',
    'Identifies invalid or unfair clauses in German consumer terms and conditions under BGB §307–309 (F1 0.2400 vs Jev 0.2038).',
    {
      sha256: 'c6aa324355674580ac9697eea152702ea4f0ce7c74175f7a085df4049c862afe',
      form: 'adapter',
      questionKey: 'answer',
      questionType: 'noul',
      labels: ['valid', 'potentially_void'],
      repairs: 34,
      damage: 0,
      latencyUs: 6,
    },
  ),
  capabilityListing(
    'go-emotions-28',
    'go-emotions-28 — Fine-Grained 28-Emotion Affect Adapter Suite (Kai 1.13)',
    'Classification',
    'Multi-label fine-grained emotion recognition across 28 affective states (macro-F1 0.4058 vs Jev 0.2434).',
    {
      sha256: '8ba02d309cf897acd941686f1b1a8d8497f93220eab0d393b894f01fffae6174',
      form: 'adapter',
      questionKey: 'admiration',
      questionType: 'noul',
      labels: ['admiration', 'gratitude', 'joy', 'optimism', 'curiosity', 'neutral'],
      repairs: 540,
      damage: 0,
      latencyUs: 8,
    },
  ),
  capabilityListing(
    'triage',
    'triage — Support Ticket & Issue Routing Adapter',
    'Operations',
    'Routes incoming support requests and engineering incidents into billing, security, outage, or product queues in microseconds.',
    {
      sha256: '5b3e91a70c84d2f6193b8e40a7c52d19f6e8034c21a7d95b680e41f3c92a76d8',
      form: 'adapter',
      questionKey: 'triage',
      questionType: 'choice',
      labels: ['billing', 'security', 'outage', 'product'],
      repairs: 128,
      damage: 0,
      latencyUs: 9,
    },
  ),
]

export const DEFAULT_MCP_CATALOG: readonly McpListing[] = [
  {
    id: 'hanzo-mcp',
    name: 'hanzo-mcp',
    title: 'Hanzo MCP Core (60+ Developer & Cloud Tools)',
    vendor: 'Hanzo AI',
    description:
      'The complete open-source Model Context Protocol server for Hanzo AI. Provides 60+ unified tools for AST code search, file editing, shell execution, git worktrees, memory, and cloud orchestration (`npx -y @hanzo/mcp`).',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://docs.hanzo.ai/docs/mcp',
    version: '2.4.0',
    transports: ['stdio', 'http', 'sse'],
    remotes: [{ transport: 'http', url: 'https://api.hanzo.ai/v1/mcp' }],
    featured: true,
    official: true,
  },
  {
    id: 'hanzo-cloud-mcp',
    name: 'hanzo-cloud-mcp',
    title: 'Hanzo Cloud MCP',
    vendor: 'Hanzo AI',
    description:
      'Connect Claude, Cursor, Hanzo Dev, or any MCP client to Hanzo Cloud with one URL. Exposes IAM, KMS, Billing, PaaS, Vector, SQL, Storage, and x402 settlement as native MCP tools.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://hanzo.ai/docs/mcp',
    version: '1.8.0',
    transports: ['http', 'sse'],
    remotes: [{ transport: 'http', url: 'https://api.hanzo.ai/v1/mcp' }],
    featured: true,
    official: true,
  },
  {
    id: 'github-connector',
    name: 'github-connector',
    title: 'GitHub Connector & MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Two-way GitHub integration and MCP server. Connect repositories, automate pull requests, review diffs, triage issues, inspect GitHub Actions workflows, and subscribe to webhook events.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.5.0',
    transports: ['http', 'stdio'],
    remotes: [{ transport: 'http', url: 'https://api.hanzo.ai/v1/mcp/github' }],
    featured: true,
    official: true,
  },
  {
    id: 'slack-connector',
    name: 'slack-connector',
    title: 'Slack Connector & MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Official Slack workspace connector and MCP server. Mention @Hanzo in any channel or thread, stream agent updates, search workspace history, and trigger automated workflows.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.4.2',
    transports: ['http', 'stdio'],
    remotes: [{ transport: 'http', url: 'https://api.hanzo.ai/v1/mcp/slack' }],
    featured: true,
    official: true,
  },
  {
    id: 'discord-connector',
    name: 'discord-connector',
    title: 'Discord Connector & Bot MCP',
    vendor: 'Hanzo AI',
    description:
      'Connect Hanzo agents and personas to Discord servers. Supports slash commands, thread support triage, community moderation, and voice channel transcription.',
    repo: 'https://github.com/hanzoai/bot',
    site: 'https://github.com/hanzoai/bot',
    version: '1.3.0',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'telegram-connector',
    name: 'telegram-connector',
    title: 'Telegram Connector & Bot MCP',
    vendor: 'Hanzo AI',
    description:
      'Deploy Hanzo agents to Telegram groups and direct messages with inline buttons, media understanding, wallet notifications, and webhook triggers.',
    repo: 'https://github.com/hanzoai/bot',
    site: 'https://github.com/hanzoai/bot',
    version: '1.3.0',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'linear-connector',
    name: 'linear-connector',
    title: 'Linear Connector & Issue Triage MCP',
    vendor: 'Hanzo AI',
    description:
      'Sync Linear issues, projects, and cycles with Hanzo Dev. Automatically turn bug reports and feature specs into assigned agent coding runs and linked PRs.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.2.1',
    transports: ['http', 'stdio'],
    featured: true,
    official: true,
  },
  {
    id: 'notion-connector',
    name: 'notion-connector',
    title: 'Notion Connector & Knowledge MCP',
    vendor: 'Hanzo AI',
    description:
      'Read and write Notion pages, databases, and wikis over MCP. Keep architecture docs, meeting notes, and product specs continuously indexed in Hanzo Vector.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.2.0',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'google-workspace-connector',
    name: 'google-workspace-connector',
    title: 'Google Workspace Connector (Drive, Gmail, Calendar)',
    vendor: 'Hanzo AI',
    description:
      'OAuth-scoped connector for Google Drive, Docs, Sheets, Gmail, and Calendar. Let agents draft replies, schedule meetings, and analyze spreadsheets securely.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.3.1',
    transports: ['http', 'stdio'],
    featured: true,
    official: true,
  },
  {
    id: 'stripe-x402-mcp',
    name: 'stripe-x402-mcp',
    title: 'Stripe, Hanzo Commerce & x402 Payments MCP',
    vendor: 'Hanzo AI',
    description:
      'Unified payment and settlement MCP server. Manage Stripe subscriptions, invoices, checkout links, and autonomous x402 micropayments with automatic creator revenue splits.',
    repo: 'https://github.com/hanzoai/commerce',
    site: 'https://hanzo.ai/payments',
    version: '1.6.0',
    transports: ['http', 'stdio'],
    featured: true,
    official: true,
  },
  {
    id: 'postgres-sql-mcp',
    name: 'postgres-sql-mcp',
    title: 'PostgreSQL & Vector SQL MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Inspect database schemas, run read-only or transactional SQL queries, analyze query plans, and search pgvector embeddings directly from any MCP agent.',
    repo: 'https://github.com/hanzoai/sql',
    site: 'https://hanzo.ai/datastore',
    version: '1.4.0',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 'redis-kv-mcp',
    name: 'redis-kv-mcp',
    title: 'Hanzo KV & Redis MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Sub-millisecond key-value state, distributed locks, pub/sub event streams, and rate-limiter inspection for stateful multi-agent workflows.',
    repo: 'https://github.com/hanzoai/kv',
    site: 'https://github.com/hanzoai/kv',
    version: '1.2.0',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 's3-storage-mcp',
    name: 's3-storage-mcp',
    title: 'Hanzo Storage & S3 Object MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Manage S3-compatible buckets, upload and stream artifacts, generate presigned URLs, and inspect dataset shards across Hanzo Storage (`s3.hanzo.ai`).',
    repo: 'https://github.com/hanzoai/storage',
    site: 'https://github.com/hanzoai/storage',
    version: '1.3.0',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 'browser-playwright-mcp',
    name: 'browser-playwright-mcp',
    title: 'Hanzo Browser & Playwright MCP Server',
    vendor: 'Hanzo AI',
    description:
      'Drive headless Chromium over MCP. Navigate SPAs, click elements, fill forms, capture accessibility snapshots, inspect console/network logs, and run visual QA.',
    repo: 'https://github.com/hanzoai/operative',
    site: 'https://github.com/hanzoai/operative',
    version: '1.5.2',
    transports: ['stdio', 'http'],
    featured: true,
    official: true,
  },
  {
    id: 'docker-k8s-mcp',
    name: 'docker-k8s-mcp',
    title: 'Docker & Kubernetes Infrastructure MCP',
    vendor: 'Hanzo AI',
    description:
      'Build container images, inspect Kubernetes pods and deployments, tail container logs, and manage Helm releases across local and cloud clusters.',
    repo: 'https://github.com/hanzoai/paas',
    site: 'https://github.com/hanzoai/paas',
    version: '1.3.4',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 'web3-lux-evm-mcp',
    name: 'web3-lux-evm-mcp',
    title: 'Lux & EVM Web3 Wallet & Contract MCP',
    vendor: 'Hanzo AI',
    description:
      'Query EVM and Lux chains, read smart-contract state, simulate transactions, sign digests with Hanzo MPC wallets, and settle x402 jobs on-chain.',
    repo: 'https://github.com/hanzoai/web3',
    site: 'https://github.com/hanzoai/web3',
    version: '1.4.0',
    transports: ['stdio', 'http'],
    featured: true,
    official: true,
  },
  {
    id: 'observe-sentry-mcp',
    name: 'observe-sentry-mcp',
    title: 'Hanzo Observe, OpenTelemetry & Sentry MCP',
    vendor: 'Hanzo AI',
    description:
      'Query production traces, LLM token metrics, error stack traces, and latency histograms from `observe.hanzo.ai` and Sentry to close the loop on production bugs.',
    repo: 'https://github.com/hanzoai/observe',
    site: 'https://hanzo.ai/analytics',
    version: '1.2.3',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'websearch-crawler-mcp',
    name: 'websearch-crawler-mcp',
    title: 'Hanzo Web Search & Markdown Crawler MCP',
    vendor: 'Hanzo AI',
    description:
      'Privacy-preserving meta-search across web, news, and scientific literature with clean HTML-to-Markdown extraction and citation grounding.',
    repo: 'https://github.com/hanzoai/search',
    site: 'https://github.com/hanzoai/search',
    version: '1.4.1',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'memory-graph-mcp',
    name: 'memory-graph-mcp',
    title: 'Hanzo Memory & Knowledge Graph MCP',
    vendor: 'Hanzo AI',
    description:
      'Persistent episodic and semantic memory for agents. Stores entities, relations, and project decisions with multi-hop graph traversal and vector recall.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.3.0',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 'figma-design-mcp',
    name: 'figma-design-mcp',
    title: 'Figma & Design Tokens Connector MCP',
    vendor: 'Hanzo AI',
    description:
      'Read Figma frames, layout constraints, variables, and SVG icons directly into `@hanzo/ui` and `@hanzo/design` components.',
    repo: 'https://github.com/hanzoai/design',
    site: 'https://github.com/hanzoai/design',
    version: '1.1.0',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
  {
    id: 'jira-atlassian-connector',
    name: 'jira-atlassian-connector',
    title: 'Jira & Confluence Enterprise Connector',
    vendor: 'Hanzo AI',
    description:
      'Bi-directional enterprise connector for Atlassian Jira sprints, epics, service desk tickets, and Confluence engineering documentation.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.1.2',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'hubspot-crm-connector',
    name: 'hubspot-crm-connector',
    title: 'HubSpot & CRM Pipeline Connector',
    vendor: 'Hanzo AI',
    description:
      'Sync contacts, accounts, deal stages, and call transcripts with Hanzo Growth and Leo agents for automated lead qualification and follow-ups.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.1.0',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'shopify-commerce-connector',
    name: 'shopify-commerce-connector',
    title: 'Shopify & Hanzo Commerce Connector',
    vendor: 'Hanzo AI',
    description:
      'Connect storefronts, product catalogs, orders, inventory, and customer support workflows across Hanzo Commerce and Shopify.',
    repo: 'https://github.com/hanzoai/commerce',
    site: 'https://github.com/hanzoai/commerce',
    version: '1.2.0',
    transports: ['http', 'stdio'],
    featured: false,
    official: true,
  },
  {
    id: 'cloudflare-edge-mcp',
    name: 'cloudflare-edge-mcp',
    title: 'Cloudflare DNS, Workers & Edge WAF MCP',
    vendor: 'Hanzo AI',
    description:
      'Manage DNS records, edge workers, cache purges, tunnels, and WAF rules across Cloudflare and Hanzo Edge.',
    repo: 'https://github.com/hanzoai/mcp',
    site: 'https://github.com/hanzoai/mcp',
    version: '1.1.4',
    transports: ['stdio', 'http'],
    featured: false,
    official: true,
  },
]

function matchesQuery(fields: (string | undefined)[], q: string): boolean {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = fields.filter(Boolean).join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}

/**
 * Merges live `/v1/marketplace/shop` results with first-party open-source
 * agents and platform tools so the catalog is always complete even when the
 * backend database only has the initial seed rows.
 */
export function mergeShop(remote: Shop | null, q: string, kind: Kind | ''): Shop {
  const baseListings = remote?.listings ?? []
  const seenIds = new Set(baseListings.map((l) => l.id))
  const seenTools = new Set(baseListings.map((l) => `${l.kind}:${l.tool.toLowerCase()}`))

  const extrasForFacets = DEFAULT_LISTINGS.filter(
    (d) => !seenIds.has(d.id) && !seenTools.has(`${d.kind}:${d.tool.toLowerCase()}`),
  )

  const facetKind: Partial<Record<Kind, number>> = { ...remote?.facets.kind }
  for (const d of extrasForFacets) {
    if (matchesQuery([d.title, d.description, d.category, d.tool, d.publisherOrg], q)) {
      facetKind[d.kind] = (facetKind[d.kind] ?? 0) + 1
    }
  }

  const filteredExtras = extrasForFacets.filter(
    (d) =>
      (!kind || d.kind === kind) &&
      matchesQuery([d.title, d.description, d.category, d.tool, d.publisherOrg], q),
  )

  const merged = [...baseListings, ...filteredExtras]
  const total = (remote?.total ?? baseListings.length) + filteredExtras.length

  return {
    listings: merged,
    total,
    facets: {
      kind: facetKind,
      category: remote?.facets.category ?? {},
      price: remote?.facets.price ?? {},
      rating: remote?.facets.rating ?? {},
    },
  }
}

/** Finds a default listing by ID when `/v1/marketplace/shop/:id` is a static OSS entry. */
export function findDefaultListing(id: string): ShopListing | undefined {
  return DEFAULT_LISTINGS.find((l) => l.id === id || l.tool === id)
}

/**
 * Merges `/v1/tool/catalog` results with the open-source MCP & Connector catalog
 * so both signed-out and signed-in visitors can browse all MCP servers & connectors.
 */
export function mergeMcpCatalog(remote: McpListing[], q: string): { catalog: McpListing[]; total: number } {
  const seen = new Set(remote.map((m) => m.id.toLowerCase()))
  const seenNames = new Set(remote.map((m) => m.name.toLowerCase()))
  const extras = DEFAULT_MCP_CATALOG.filter(
    (m) => !seen.has(m.id.toLowerCase()) && !seenNames.has(m.name.toLowerCase()),
  )
  const combined = [...remote, ...extras].filter((m) =>
    matchesQuery([m.title, m.name, m.description, m.vendor, m.id], q),
  )
  return { catalog: combined, total: combined.length }
}

/** Finds an MCP server or connector in the static OSS catalog by ID or name. */
export function findDefaultMcp(id: string): McpListing | undefined {
  const lower = id.toLowerCase()
  return DEFAULT_MCP_CATALOG.find((m) => m.id.toLowerCase() === lower || m.name.toLowerCase() === lower)
}
