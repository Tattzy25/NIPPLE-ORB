export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type VoiceState = 'idle' | 'listening' | 'speaking' | 'processing';

export interface TranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

export interface SharedImageItem {
  id: string;
  sender: 'user' | 'agent';
  url: string;
  title?: string;
  caption?: string;
  timestamp: string;
}

export interface RecommendedProductItem {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  tags: string[];
  shopifyHandle?: string;
}

export interface ConversationHistorySession {
  id: string;
  startTime: string;
  durationSeconds: number;
  transcripts: TranscriptItem[];
  sharedImages: SharedImageItem[];
  products: RecommendedProductItem[];
}
