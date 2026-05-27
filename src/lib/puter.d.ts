// Minimal ambient typings for Puter.js v2 — only the surface we use.
// See https://docs.puter.com/AI/chat/

export {};

declare global {
  interface PuterChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<{ type: string; text?: string; puter_path?: string }>;
  }

  interface PuterChatOptions {
    model?: string;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    response_format?: { type: "json_object" | "text" };
    [k: string]: unknown;
  }

  interface PuterChatResponse {
    message: {
      role: "assistant";
      content: string | Array<{ type: string; text?: string }>;
      tool_calls?: unknown[];
    };
    toString(): string;
  }

  interface PuterAi {
    chat(
      messages: PuterChatMessage[],
      testMode?: boolean,
      options?: PuterChatOptions,
    ): Promise<PuterChatResponse>;
    chat(prompt: string, options?: PuterChatOptions): Promise<PuterChatResponse>;
  }

  interface PuterAuth {
    isSignedIn(): boolean;
    signIn(): Promise<void>;
    getUser(): Promise<{ username: string }>;
  }

  interface PuterGlobal {
    ai: PuterAi;
    auth: PuterAuth;
    print: (text: string) => void;
  }

  // eslint-disable-next-line no-var
  var puter: PuterGlobal | undefined;
}
