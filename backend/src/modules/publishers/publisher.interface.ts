export interface PublishParams {
  postId: string;
  targetId: string;
  caption: string;
  firstComment?: string | null;
  mediaUrls: string[];
  channel: {
    id: string;
    network: string;
    externalId: string;
    name?: string | null;
    handle: string;
    accessTokenEnc?: string | null;
  };
  cachedContainerId?: string | null;
}

export interface PublishResult {
  externalPostId: string;
  metaContainerId?: string | null;
  metrics?: Record<string, any>;
  rawResponse?: any;
}

export interface Publisher {
  publish(params: PublishParams): Promise<PublishResult>;
}
