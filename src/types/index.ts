export interface Case {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  case_id: string;
  role: 'user' | 'assistant';
  content: string;
  compressed_summary?: string;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  character: string;
  strategy: string;
  reasoning: string;
  system_prompt: string;
  google_ai_key: string;
  updated_at: string;
}