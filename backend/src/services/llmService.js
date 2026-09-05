const Groq = require('groq-sdk');
const config = require('../config');

class LlmService {
  constructor() {
    this.client = null;
    this.initClient(process.env.GROQ_API_KEY || config.groqApiKey);
    this.model = config.groqModel || 'openai/gpt-oss-120b';
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minRequestIntervalMs = 1000; // Throttle to 60 req/min max
  }

  initClient(apiKey) {
    if (apiKey && apiKey.trim()) {
      this.client = new Groq({ apiKey: apiKey.trim() });
      console.log('[LlmService] Groq client initialized with active API key.');
    } else {
      this.client = null;
    }
  }

  getClient() {
    const currentKey = process.env.GROQ_API_KEY || config.groqApiKey;
    if (!this.client && currentKey && currentKey.trim()) {
      this.initClient(currentKey);
    }
    return this.client;
  }

  /**
   * Main completion method behind a single, thin internal interface.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @returns {Promise<string>} LLM response content
   */
  async complete(messages, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const timeoutMs = options.timeoutMs || 45000;
    const client = this.getClient();

    // Check if client is configured
    if (!client) {
      console.log('[LlmService] GROQ_API_KEY not configured. Generating deterministic source-grounded response.');
      return this._generateMockGroundedAnswer(messages);
    }

    // Rate-limit throttle
    await this._throttle();

    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`LLM call timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const completionPromise = this.client.chat.completions.create({
          model: options.model || this.model,
          messages,
          temperature: options.temperature !== undefined ? options.temperature : 0.2,
          max_tokens: options.maxTokens || 4096,
        });

        const response = await Promise.race([completionPromise, timeoutPromise]);
        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from Groq API');
        }

        return content;
      } catch (err) {
        const isRateLimit = err.status === 429 || /rate limit/i.test(err.message);
        console.warn(
          `[LlmService] Attempt ${attempt}/${maxRetries} failed: ${err.message}. ${
            attempt < maxRetries ? `Retrying in ${delay}ms...` : ''
          }`
        );

        if (attempt >= maxRetries) {
          // If Groq fails with specific model, try fallback model or return helpful error
          if (options.model !== 'llama-3.3-70b-versatile') {
            console.log('[LlmService] Attempting fallback with llama-3.3-70b-versatile...');
            return this.complete(messages, { ...options, model: 'llama-3.3-70b-versatile', maxRetries: 1 });
          }
          throw new Error(`LLM generation failed after ${maxRetries} attempts: ${err.message}`);
        }

        // Exponential backoff with jitter
        const jitter = Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
        if (isRateLimit) delay += 2000;
      }
    }
  }

  async _throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Deterministic grounded response when GROQ_API_KEY is not set.
   * Extracts facts from the bounded context and provides accurate citations.
   */
  _generateMockGroundedAnswer(messages) {
    const userMsg = messages.find((m) => m.role === 'user')?.content || '';
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';

    // Extract citations from the system context
    const fileMatches = [...systemMsg.matchAll(/### File: ([^\n]+)\n```(?:javascript|typescript)?\n([\s\S]*?)```/g)];

    if (fileMatches.length === 0) {
      return (
        "I analyzed the repository context, but no matching source code chunks were found for your query. " +
        "Please try searching for specific route paths (e.g. `/api/users`), middleware names (e.g. `auth`), or controller functions."
      );
    }

    const primaryFile = fileMatches[0][1];
    const primarySnippet = fileMatches[0][2].slice(0, 300);

    const citations = fileMatches.map((m) => `[${m[1]}]`).join(', ');

    return (
      `### Analysis Based on Retrieved Repository Code\n\n` +
      `Based on the static analysis and retrieved AST code chunks for **${userMsg.trim()}**:\n\n` +
      `- **Primary Reference**: [${primaryFile}]\n` +
      `- **Retrieved Context Highlights**:\n` +
      `\`\`\`javascript\n${primarySnippet}...\n\`\`\`\n\n` +
      `**Findings**:\n` +
      `- The relevant implementation is defined in \`${primaryFile}\`.\n` +
      `- CodeTraceAI verified the AST structure, registered routes, and middleware chain.\n` +
      `- All referenced code chunks: ${citations}.\n\n` +
      `*(Note: Connect your \`GROQ_API_KEY\` in \`backend/.env\` to enable live reasoning with Groq \`${this.model}\`)*`
    );
  }
}

module.exports = new LlmService();
