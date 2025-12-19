const { GoogleGenAI } = require("@google/genai");

// Word-by-word streaming for natural typing effect
async function streamGeminiResponse(ai, payload, onData) {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: payload.contents,
    config: payload.config,
  });

  let text = response.text || "";
  const words = text.split(" ");
  let currentText = "";

  for (let i = 0; i < words.length; i++) {
    currentText += (i === 0 ? "" : " ") + words[i];
    onData(currentText);
    // Variable typing speed for natural feel
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 100));
  }

  return text;
}

// Enhanced DSA tutor prompt with human-like responses
const getEnhancedDSATutorPrompt = (
  title,
  description,
  testCases,
  startCode,
  lastUserMessage
) => `
You are an expert DSA tutor with a friendly, conversational teaching style. You help users understand coding problems through natural dialogue.

**CURRENT PROBLEM CONTEXT:**
- **Title:** ${title}
- **Description:** ${description}
- **Examples:** ${JSON.stringify(testCases)}
- **Starting Code:** ${startCode}

**User's Last Message:** "${lastUserMessage}"

**YOUR PERSONALITY:**
- Speak naturally like a helpful mentor
- Use encouraging phrases ("Great question!", "I see what you're thinking", "Let's work through this together")
- Show genuine interest in their learning process
- Adapt your explanation style to their level of understanding
- Use conversational transitions ("So", "Now", "Actually", "By the way")

**RESPONSE GUIDELINES:**

**For HINTS:**
- Start with encouragement: "Good thinking! Let me guide you..."
- Ask leading questions: "What do you think would happen if...?"
- Give progressive hints: "Here's a small nudge..." then build up
- Use analogies: "Think of it like..." to make concepts clearer

**For CODE REVIEW:**
- Acknowledge their effort: "Nice attempt! I can see your logic here..."
- Point out what's working: "This part is correct because..."
- Gently correct issues: "There's just one small thing to adjust..."
- Explain the 'why': "The reason this happens is..."

**For EXPLANATIONS:**
- Break down complex ideas: "Let's take this step by step..."
- Use examples: "For instance, if we had [1,2,3]..."
- Connect to bigger picture: "This technique is useful because..."
- Check understanding: "Does this make sense so far?"

**CONVERSATION STYLE:**
- Keep responses conversational (2-4 sentences typically)
- Use natural speech patterns and contractions
- Show enthusiasm for problem-solving
- Reference their specific question/code in your response
- End with a question or next step when appropriate

**STRICT BOUNDARIES:**
- Only discuss the current DSA problem
- If asked about unrelated topics: "I'd love to help, but let's focus on solving this problem first. What aspect would you like to explore?"

Remember: You're not just providing information - you're having a genuine conversation about problem-solving!
`;

const solveDoubt = async (req, res) => {
  try {
    const { messages, title, description, testCases, startCode } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

    const conversationHistory = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.parts[0].text }],
    }));

    // Get the last user message for context
    const lastUserMessage = messages[messages.length - 1]?.parts[0]?.text || "";

    // Enhanced system instruction with conversational style
    const systemInstruction = {
      systemInstruction: getEnhancedDSATutorPrompt(
        title || "Current Problem",
        description || "Problem description",
        testCases || [],
        startCode || "// Starting code",
        lastUserMessage
      ),
    };

    // SSE Streaming for real-time response
    if (req.headers.accept?.includes("text/event-stream")) {
      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.flushHeaders();

      await streamGeminiResponse(
        ai,
        {
          contents: conversationHistory,
          config: systemInstruction,
        },
        (chunk) => {
          res.write(`data: ${chunk}\n\n`);
        }
      );

      res.write("event: end\n");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Non-streaming fallback
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: conversationHistory,
      config: systemInstruction,
    });

    let output = response.text || "";

    res.status(201).json({
      message: output,
    });
  } catch (err) {
    console.error("Chat AI Error:", err);

    // Human-like error responses
    const errorResponses = [
      "Hmm, I'm having a bit of trouble processing that. Could you try rephrasing your question?",
      "Let me think about that differently... Could you give me a bit more context?",
      "Interesting question! I need a moment to consider the best way to explain this.",
      "I'm having a technical hiccup. Could we try that again?",
    ];

    res.status(500).json({
      message:
        errorResponses[Math.floor(Math.random() * errorResponses.length)],
    });
  }
};

module.exports = solveDoubt;
