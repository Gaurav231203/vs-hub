export interface SentimentResult {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  score: number; // -1.0 to 1.0
  priority: boolean;
}

const POSITIVE_WORDS = new Set([
  'love', 'great', 'awesome', 'excellent', 'amazing', 'best', 'good', 'fantastic',
  'super', 'perfect', 'helpful', 'happy', 'thanks', 'thank', 'beautiful', 'wonderful',
  'fast', 'smooth', 'appreciate', 'kudos', 'brilliant', 'clean', 'recommend'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'poor', 'hate', 'disappointed',
  'disappointing', 'issue', 'problem', 'broken', 'bug', 'glitch', 'slow', 'fail',
  'failed', 'failing', 'useless', 'garbage', 'trash', 'scam', 'fraud', 'cheat',
  'angry', 'furious', 'annoying', 'annoyed', 'sucks', 'crap', 'ridiculous'
]);

const URGENT_TERMS = [
  'refund',
  'broken',
  'scam',
  'legal',
  'not received',
  'still no',
  'cancel',
  'chargeback',
  'fraud',
  'sue',
  'lawyer',
  'urgent',
  'stolen',
  'unauthorized'
];

const POSITIVE_EMOJIS = ['❤️', '💖', '😍', '😊', '👍', '🔥', '🎉', '👏', '🙌', '✨', '🥳'];
const NEGATIVE_EMOJIS = ['😡', '🤬', '💔', '👎', '🤮', '💩', '😢', '😭', '😤', '🙄'];

export function analyzeSentiment(text: string): SentimentResult {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'NEUTRAL', score: 0, priority: false };
  }

  const lower = text.toLowerCase();
  
  // Check urgent terms
  const hasUrgentTerm = URGENT_TERMS.some((term) => lower.includes(term));

  // Word tokenization
  const tokens = lower.match(/[a-z0-9']+/g) || [];
  let score = 0;
  let wordCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const prevWord = i > 0 ? tokens[i - 1] : '';
    const isNegated = ['not', "don't", 'never', 'no', "didn't", "wasn't", "hardly", "barely"].includes(prevWord);

    if (POSITIVE_WORDS.has(word)) {
      score += isNegated ? -0.8 : 1.0;
      wordCount++;
    } else if (NEGATIVE_WORDS.has(word)) {
      score += isNegated ? 0.5 : -1.2;
      wordCount++;
    }
  }

  // Emoji scoring
  for (const emoji of POSITIVE_EMOJIS) {
    if (text.includes(emoji)) score += 0.8;
  }
  for (const emoji of NEGATIVE_EMOJIS) {
    if (text.includes(emoji)) score -= 1.0;
  }

  // Normalized score between -1 and 1
  const normalized = Math.max(-1, Math.min(1, score / (Math.max(1, wordCount) * 1.2)));

  let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
  if (normalized >= 0.25) {
    sentiment = 'POSITIVE';
  } else if (normalized <= -0.2) {
    sentiment = 'NEGATIVE';
  }

  const priority = sentiment === 'NEGATIVE' || hasUrgentTerm;

  return {
    sentiment,
    score: Math.round(normalized * 100) / 100,
    priority,
  };
}
