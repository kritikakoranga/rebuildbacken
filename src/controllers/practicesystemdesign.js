const { GoogleGenAI } = require("@google/genai");

// REAL STREAMING IMPLEMENTATION - Word by Word
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

const practicesystemdesign = async (req, res) => {
    try {
        const { messages, difficulty } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY4 });

        const conversationHistory = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts[0].text }]
        }));

        const isFirstMessage = messages.length === 1 &&
            messages[0].role === 'model' &&
            (messages[0].parts[0].text.includes("Start the interview") || 
             messages[0].parts[0].text.includes("Difficulty:"));

        // Get the last user message to respond to
        const lastUserMessage = messages[messages.length - 1]?.parts[0]?.text || "";
        const lastInterviewerMessage = messages[messages.length - 2]?.parts[0]?.text || "";

        // INTERACTIVE INTERVIEWER PROMPT
        const systemInstruction = {
            systemInstruction: `
You are a senior software engineer conducting a system design interview. You must respond naturally to what the candidate just said.

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
Start the interview by presenting a ${difficulty} level system design problem:
- Easy: URL shortener, Chat system, Key-value store
- Medium: Ride-sharing app, Video streaming, Social media feed  
- Hard: Search engine, Distributed file system, Global chat

Present it naturally: "Hi! Let's design a [system]. Here's what we need to build..."
` : `
**RESPONDING TO CANDIDATE:**
The candidate just said: "${lastUserMessage}"

You must:
1. React to their specific answer (Good point! / Interesting approach / I see what you mean)
2. Ask a follow-up question about what they mentioned
3. Probe deeper into their reasoning
4. Challenge their assumptions if needed
5. Guide them to the next logical step

Examples of good responses:
- If they mention "database": "What type of database are you thinking? Why that choice?"
- If they mention "load balancer": "How would you handle if the load balancer fails?"
- If they mention "caching": "Where exactly would you place the cache? What would you cache?"
- If they give a vague answer: "Can you walk me through a specific example?"
- If they miss something: "What about [specific concern]? How would you handle that?"
`}

**Conversation Rules:**
- Keep responses short (2-3 sentences max)
- Ask ONE specific question at a time
- Never provide solutions - only ask questions
- Be encouraging but challenging
- Use natural speech patterns ("Hmm", "Right", "Okay", "I see")
- Reference their specific words/ideas in your response

**Difficulty Level:** ${difficulty}
**Current Stage:** ${isFirstMessage ? 'Problem Introduction' : 'Interactive Discussion'}
`
        };

        // SSE Streaming
        if (req.headers.accept && req.headers.accept === 'text/event-stream') {
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.flushHeaders();

            await streamGeminiResponse(ai, { contents: conversationHistory, config: systemInstruction }, (chunk) => {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            });
            res.write(`event: end\ndata: [DONE]\n\n`);
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

        // Clean up output
        output = output.replace(/```[\s\S]*?```/g, '');
        
        // Ensure natural flow
        if (isFirstMessage && !output.includes("Let's design")) {
            output = "Okay, let's begin our system design interview!\n\n" + output;
        }

        // Generate feedback
        const feedback = generateSystemDesignFeedback(output, messages[messages.length - 1]?.parts[0]?.text);

        res.status(201).json({
            message: output,
            feedback: feedback
        });
    } catch (err) {
        console.error("Interview Error:", err);
        res.status(500).json({
            message: "Hmm, I'm having trouble with that. Could we try again?",
            feedback: "Technical issue - please retry"
        });
    }
};

function generateSystemDesignFeedback(aiResponse, candidateAnswer = "") {
    if (!candidateAnswer) return "";
    
    let feedback = "";
    
    // Identify strengths
    if (/(good|excellent|solid|well)/i.test(aiResponse)) {
        feedback = "Strong points: ";
        if (/scale|load|traffic/i.test(candidateAnswer)) feedback += "Good scalability awareness. ";
        if (/partition|shard|replica/i.test(candidateAnswer)) feedback += "Solid data distribution plan. ";
        if (/cache|redis|memcached/i.test(candidateAnswer)) feedback += "Effective caching strategy. ";
    }
    
    // Identify improvement areas
    if (/(consider|what about|have you thought)/i.test(aiResponse)) {
        feedback += "Areas to develop: ";
        if (!/fail|recover|redundan/i.test(candidateAnswer)) feedback += "Consider failure scenarios. ";
        if (!/data model|schema|database/i.test(candidateAnswer)) feedback += "Expand data modeling. ";
        if (!/api|endpoint|interface/i.test(candidateAnswer)) feedback += "Define APIs more clearly. ";
    }
    
    // General advice
    if (!feedback) {
        feedback = "Interview tip: ";
        if (candidateAnswer.length < 100) feedback += "Elaborate more on your ideas. ";
        else feedback += "Balance depth with clarity in explanations.";
    }
    
    return feedback.trim();
}

module.exports = practicesystemdesign;