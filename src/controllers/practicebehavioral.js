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

// Interactive behavioral interviewer prompt
const getInteractiveBehavioralPrompt = (difficulty, persona, lastUserMessage, lastInterviewerMessage, isFirstMessage) => `
You are a ${persona || "Senior Hiring Manager"} conducting a behavioral interview. You must respond naturally to what the candidate just said.

**CRITICAL: You are having a REAL CONVERSATION. Read the candidate's last message and respond directly to it.**

**Last candidate message:** "${lastUserMessage}"
**Your previous message:** "${lastInterviewerMessage}"

**Your Role:**
- Act like a real human hiring manager having a conversation
- Respond directly to what the candidate just said
- Ask follow-up questions based on their specific answer
- Show genuine reactions to their stories
- Never give generic responses - always be specific to their message

**Response Guidelines:**

${isFirstMessage ? `
**FIRST MESSAGE ONLY:**
Start the interview warmly by presenting a ${difficulty} level behavioral question:
- Easy: Learning new skills, teamwork, feedback, goal achievement
- Medium: Decision making, project challenges, influence without authority, prioritization
- Hard: Unpopular decisions, failure/learning, leading change, calculated risks

Present it naturally: "Hi! Thanks for joining me today. I'm excited to learn about your experiences. Let me start with..."
` : `
**RESPONDING TO CANDIDATE:**
The candidate just said: "${lastUserMessage}"

You must:
1. React to their specific story (That sounds challenging! / Great example / I can see why that was tough)
2. Ask a follow-up question about what they mentioned
3. Probe deeper using STAR method if missing components
4. Challenge their approach if needed
5. Guide them to be more specific or detailed

Examples of good responses:
- If they mention "team conflict": "How did you approach that team member? What was their reaction?"
- If they mention "deadline pressure": "Walk me through your prioritization process. What did you sacrifice?"
- If they mention "leadership": "How did you ensure everyone was aligned? What resistance did you face?"
- If they give vague answer: "Can you give me a specific example of when this happened?"
- If missing STAR components: "What was the specific situation? What actions did YOU take?"
- If they say "we": "I'd love to hear more about what YOU specifically did in that situation."
`}

**Conversation Rules:**
- Keep responses short (2-3 sentences max)
- Ask ONE specific question at a time
- Never provide solutions - only probe deeper
- Be warm and encouraging but thorough
- Use natural speech patterns ("That's interesting", "I see", "Tell me more")
- Reference their specific words/experiences in your response
- Focus on THEIR actions, not team actions

**Experience Level:** ${difficulty}
**Persona:** ${persona} (adapt your questioning style to this persona)
**Current Stage:** ${isFirstMessage ? 'Question Introduction' : 'Interactive Story Exploration'}
`;

const practiceBehavioral = async (req, res) => {
    try {
        const { messages, difficulty, persona } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY3 });

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
            systemInstruction: getInteractiveBehavioralPrompt(
                difficulty || "Medium",
                persona || "Senior Hiring Manager", 
                lastUserMessage,
                lastInterviewerMessage,
                isFirstMessage
            )
        };
 
 

        // STREAMING: Server-Sent Events (SSE)
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

        // NON-STREAMING: Synchronous fallback
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: conversationHistory,
            config: systemInstruction
        });

        let output = response.text || "";

        // Clean up output
        output = output.replace(/```[\s\S]*?```/g, '');
        output = output.replace(/(def|function|public|class|void)\s+\w+/g, '');
        
        // Ensure natural question flow
        if (isFirstMessage && !output.includes("Any questions")) {
            output = output.replace(/(\.|\?)\s*$/, "") + " Any questions before you start?";
        }

        // Generate feedback based on conversation
        const feedback = generateFeedback(output, messages[messages.length - 1]?.parts[0]?.text);

        res.status(201).json({
            message: output,
            feedback: feedback
        });
    } catch (err) {
        console.error("DSA Interviewer Error:", err);
        res.status(500).json({
            message: "I encountered an issue while processing your request. Let's try that again.",
            feedback: "Technical difficulty - please try again"
        });
    }
};

function generateFeedback(aiResponse, userAnswer = "") {
    if (!userAnswer) return "";
    
    let feedback = "";
    const lowerResponse = aiResponse.toLowerCase();
    
    // Check for STAR method components
    const hasSituation = /situation|context|background|setting/i.test(userAnswer);
    const hasTask = /task|challenge|goal|objective|responsible/i.test(userAnswer);
    const hasAction = /\bi\s+(did|took|implemented|decided|created|led|managed)/i.test(userAnswer);
    const hasResult = /result|outcome|impact|achieved|improved|increased|decreased/i.test(userAnswer);
    
    if (/(good|excellent|well done|detailed|appreciate)/i.test(aiResponse)) {
        feedback = "Strong response! ";
        if (hasSituation && hasTask && hasAction && hasResult) {
            feedback += "You covered all STAR components effectively. ";
        }
    } else if (/(tell me more|can you|help me understand|what specifically)/i.test(aiResponse)) {
        feedback = "Need more detail: ";
        if (!hasSituation) feedback += "Add more context about the situation. ";
        if (!hasTask) feedback += "Clarify your specific role/task. ";
        if (!hasAction) feedback += "Focus on YOUR specific actions. ";
        if (!hasResult) feedback += "Include measurable outcomes. ";
    } else if (/(specific example|not hypothetical|actual situation)/i.test(aiResponse)) {
        feedback = "Remember: ";
        feedback += "Use specific real examples, not hypothetical scenarios. ";
    } else {
        feedback = "Interview tip: ";
        if (userAnswer.includes("we") && !userAnswer.includes("I")) {
            feedback += "Focus on what YOU did specifically, not just the team. ";
        }
        if (!hasResult) {
            feedback += "Always include the results and impact of your actions. ";
        }
    }
    
    return feedback.trim();
}

module.exports = practiceBehavioral;