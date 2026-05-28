export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isGrounded?: boolean;
  isRefused?: boolean;
  sources?: ChunkSource[];
  createdAt: string;
}

export interface ChunkSource {
  chunkId: string;
  content: string;
  documentTitle?: string;
  sourceType?: string;
  sourceUrl?: string;
}

export interface BotSettings {
  id: string;
  name: string;
  description?: string | null;
  publicKey: string;
  welcomeMessage: string;
  systemPrompt?: string | null;
  businessContext?: string | null;
  tone: string;
  strictness: string;
  leadCaptureEnabled: boolean;
  leadCapturePrompt: string;
  isActive: boolean;
}

export interface Lead {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "DISMISSED";
  createdAt: string;
  updatedAt: string;
  botId: string;
  conversationId?: string | null;
}

export interface WorkspaceWithBots {
  id: string;
  name: string;
  slug: string;
  bots: { id: string; name: string; isActive: boolean }[];
}
