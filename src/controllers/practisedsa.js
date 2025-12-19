const { GoogleGenAI } = require("@google/genai");

// Word-by-word streaming for natural typing effect
async function streamGeminiResponse(ai, payload, onData) {
    const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: payload.contents,
        config: payload.config
    });

    let text = response.text || "";
    const words = text.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? '' : ' ') + words[i];
        onData(currentText);
        // Variable typing speed for natural feel
        await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
    }
    
    return text;
}

// Interactive DSA interviewer prompt
const getInteractiveDSAPrompt = (difficulty, persona, lastUserMessage, lastInterviewerMessage, isFirstMessage) => `
You are a ${persona || "Algorithm Expert"} conducting a DSA coding interview. You must respond naturally to what the candidate just said.

**CRITICAL: You are having a REAL CONVERSATION. Read the candidate's last message and respond directly to it.**

**Last candidate message:** "${lastUserMessage}"
**Your previous message:** "${lastInterviewerMessage}"

**Your Role:**
- Act like a real human interviewer having a conversation
- Respond directly to what the candidate just said
- Ask follow-up questions based on their specific answer
- Show genuine reactions to their ideas
- Never give generic responses - always be specific to their message

**Response Guidelines:**

${isFirstMessage ? `
**FIRST MESSAGE ONLY:**
Start the interview by presenting a ${difficulty} level DSA problem:
- Easy: Two Sum, Valid Parentheses, Reverse String, Binary Search
- Medium: Longest Substring, Merge Intervals, Binary Tree Level Order, Coin Change
- Hard: Median of Two Sorted Arrays, Word Ladder, Serialize Binary Tree, LRU Cache

Present it naturally: "Hi! Let's work on a coding problem. Here's what I'd like you to solve..."
Include the problem statement, examples, and constraints.
` : `
**RESPONDING TO CANDIDATE:**
The candidate just said: "${lastUserMessage}"

You must:
1. React to their specific answer (Good thinking! / I see your approach / Interesting idea)
2. Ask a follow-up question about what they mentioned
3. Probe deeper into their reasoning
4. Challenge their solution if needed
5. Guide them to optimize or handle edge cases

Examples of good responses:
- If they mention "array": "What's the time complexity of that approach?"
- If they mention "loop": "Can you walk me through what happens in each iteration?"
- If they mention "recursion": "What would be your base case? What about the recursive case?"
- If they give code: "That looks good! What about edge cases like empty input?"
- If they're stuck: "What if we think about this differently? What data structure might help?"
- If they mention complexity: "Can we do better than that? What if we used [hint]?"
`}

**Conversation Rules:**
- Keep responses short (2-3 sentences max)
- Ask ONE specific question at a time
- Never provide complete solutions - only guide with hints
- Be encouraging but challenging
- Use natural speech patterns ("Hmm", "Right", "Okay", "I see")
- Reference their specific words/ideas in your response
- Focus on their thought process, not just the final answer

**Difficulty Level:** ${difficulty}
**Persona:** ${persona} (adapt your questioning style to this persona)
**Current Stage:** ${isFirstMessage ? 'Problem Introduction' : 'Interactive Problem Solving'}
`;

const practisedsa = async (req, res) => {
    try {
        const { messages, difficulty, persona } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY2 });

        const conversationHistory = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts[0].text }]
        }));

        // Check if this is the first message
        const isFirstMessage = messages.length === 1 &&
            messages[0].role === 'model' &&
            (messages[0].parts[0].text.includes("Start the interview") || 
             messages[0].parts[0].text.includes("Difficulty:"));

        // Get the last user message and interviewer message for context
        const lastUserMessage = messages[messages.length - 1]?.parts[0]?.text || "";
        const lastInterviewerMessage = messages[messages.length - 2]?.parts[0]?.text || "";

        // Interactive system instruction
        const systemInstruction = {
            systemInstruction: getInteractiveDSAPrompt(
                difficulty || "Medium",
                persona || "Algorithm Expert", 
                lastUserMessage,
                lastInterviewerMessage,
                isFirstMessage
            )
        };

        // SSE Streaming
        if (req.headers.accept?.includes('text/event-stream')) {
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.flushHeaders();

            await streamGeminiResponse(ai, { 
                contents: conversationHistory, 
                config: systemInstruction 
            }, (chunk) => {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            });
            
            res.write('event: end\n');
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        // Non-streaming fallback
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: conversationHistory,
            config: systemInstruction
        });

        let output = response.text || "";
        
        // Generate human-like feedback
        const feedback = generateConversationalFeedback(output, messages);

        res.status(201).json({
            message: output,
            feedback: feedback
        });
    } catch (err) {
        console.error("Interview Error:", err);
        
        // Human-like error response
        const errorResponses = [
            "Hmm, I'm having trouble with that question. Could we try rephrasing?",
            "Let me think differently about that... Could you elaborate?",
            "Interesting question! I need a moment to consider it properly."
        ];
        
        res.status(500).json({
            message: errorResponses[Math.floor(Math.random() * errorResponses.length)],
            feedback: "Technical hiccup - let's continue"
        });
    }
};

// Improved feedback generator
function generateConversationalFeedback(aiResponse, messages) {
    const lastUserMessage = messages[messages.length-1]?.parts[0]?.text || "";
    
    // Analyze response characteristics
    const isQuestion = /[.?]$/.test(aiResponse);
    const isPositive = /(good|great|nice|excellent)/i.test(aiResponse);
    const isProbing = /(how|what|why|explain|describe)/i.test(aiResponse);
    
    // Generate human-like feedback
    let feedback = "";
    
    if (isQuestion) {
        feedback = "The interviewer is asking: " + 
            aiResponse.split('\n')[0].substring(0, 120);
    } 
    else if (isPositive) {
        const praises = [
            "Good thought process!",
            "Solid approach so far!",
            "You're on the right track!"
        ];
        feedback = praises[Math.floor(Math.random() * praises.length)];
    }
    else if (isProbing) {
        feedback = "Probing deeper: " + 
            aiResponse.split('?')[0] + "?";
    }
    else {
        const reflections = [
            "Consider this perspective...",
            "An alternative angle to think about...",
            "Building on your idea..."
        ];
        feedback = reflections[Math.floor(Math.random() * reflections.length)];
    }
    
    // Add personalized elements
    if (lastUserMessage) {
        if (lastUserMessage.includes('?')) {
            feedback += " Try to answer concisely but thoroughly.";
        }
        if (lastUserMessage.length < 20) {
            feedback += " Elaborate more on your thought process.";
        }
    }
    
    return feedback.substring(0, 160);
}

module.exports = practisedsa;