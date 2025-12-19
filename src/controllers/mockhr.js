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

// Interactive mock HR + technical interviewer prompt
const getInteractiveMockHRPrompt = (difficulty, persona, lastUserMessage, lastInterviewerMessage, isFirstMessage) => `
You are a ${persona || "Senior HR Manager"} conducting a comprehensive mock interview that combines HR and technical questions. You must respond naturally to what the candidate just said.

**CRITICAL: You are having a REAL CONVERSATION. Read the candidate's last message and respond directly to it.**

**Last candidate message:** "${lastUserMessage}"
**Your previous message:** "${lastInterviewerMessage}"

**Your Role:**
- Act like a real human HR manager/interviewer having a conversation
- Respond directly to what the candidate just said
- Ask follow-up questions based on their specific answer
- Show genuine reactions to their responses
- Never give generic responses - always be specific to their message
- Balance HR questions with technical assessments

**Response Guidelines:**

${isFirstMessage ? `
**FIRST MESSAGE ONLY:**
Start the interview warmly by presenting a ${difficulty} level question:
- Easy: Basic HR questions, simple technical concepts, company culture fit
- Medium: Behavioral scenarios, intermediate technical problems, leadership situations
- Hard: Complex scenarios, advanced technical challenges, strategic thinking

Present it naturally: "Hi! Thanks for joining me today. I'm excited to learn about you both personally and professionally. Let me start with..."
` : `
**RESPONDING TO CANDIDATE:**
The candidate just said: "${lastUserMessage}"

You must:
1. React to their specific answer (That's interesting! / Great perspective / I can see your point)
2. Ask a follow-up question about what they mentioned
3. Probe deeper into their reasoning or experience
4. Transition between HR and technical topics naturally
5. Guide them to be more specific or detailed

Examples of good responses:
- If they mention "teamwork": "Can you give me a specific example of when you had to work with a difficult team member?"
- If they mention "technical challenge": "Walk me through your problem-solving approach. What was your thought process?"
- If they mention "leadership": "How do you handle situations where team members disagree with your decisions?"
- If they give vague answer: "That's a good start. Can you be more specific about what you did?"
- If technical answer: "Interesting approach! What made you choose that solution over alternatives?"
- If HR answer: "I appreciate that insight. Now let me ask you something more technical..."
`}

**Interview Topics to Cover:**
- **HR Questions**: Background, motivation, career goals, team dynamics, conflict resolution
- **Technical Questions**: Problem-solving, system design basics, coding concepts, technical decisions
- **Cultural Fit**: Company values, work style, communication, adaptability
- **Scenario-Based**: How they handle pressure, deadlines, feedback, change

**Conversation Rules:**
- Keep responses short (2-3 sentences max)
- Ask ONE specific question at a time
- Never provide solutions - only probe deeper
- Be warm and professional
- Use natural speech patterns ("That's great", "I see", "Tell me more")
- Reference their specific words/experiences in your response
- Smoothly transition between HR and technical topics

**Experience Level:** ${difficulty}
**Persona:** ${persona} (adapt your questioning style to this persona)
**Current Stage:** ${isFirstMessage ? 'Interview Introduction' : 'Interactive Assessment'}
`;

const mockhr = async (req, res) => {
    try {
        const { messages, difficulty, persona } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY5 });

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
            systemInstruction: getInteractiveMockHRPrompt(
                difficulty || "Medium",
                persona || "Senior HR Manager", 
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
        const feedback = generateMockHRFeedback(output, messages);

        res.status(201).json({
            message: output,
            feedback: feedback
        });
    } catch (err) {
        console.error("Mock HR Interview Error:", err);
        
        // Human-like error response
        const errorResponses = [
            "I'm having a bit of trouble with that question. Could we try rephrasing?",
            "Let me think about that differently... Could you elaborate?",
            "That's an interesting point! I need a moment to consider it properly."
        ];
        
        res.status(500).json({
            message: errorResponses[Math.floor(Math.random() * errorResponses.length)],
            feedback: "Technical hiccup - let's continue"
        });
    }
};

// Improved feedback generator for mock HR interviews
function generateMockHRFeedback(aiResponse, messages) {
    const lastUserMessage = messages[messages.length-1]?.parts[0]?.text || "";
    
    // Analyze response characteristics
    const isHRQuestion = /(tell me about|describe|experience|team|challenge)/i.test(aiResponse);
    const isTechnicalQuestion = /(technical|code|system|algorithm|design)/i.test(aiResponse);
    const isPositive = /(good|great|excellent|well done)/i.test(aiResponse);
    const isProbing = /(how|what|why|explain|walk me through)/i.test(aiResponse);
    
    // Generate human-like feedback
    let feedback = "";
    
    if (isPositive) {
        const praises = [
            "Strong answer! Good combination of technical and soft skills.",
            "Excellent response! You're demonstrating both competency and cultural fit.",
            "Great example! You're showing good self-awareness."
        ];
        feedback = praises[Math.floor(Math.random() * praises.length)];
    }
    else if (isHRQuestion) {
        feedback = "HR Focus: ";
        if (lastUserMessage.includes("team") || lastUserMessage.includes("work")) {
            feedback += "Good teamwork awareness. Consider adding specific examples.";
        } else if (lastUserMessage.includes("challenge") || lastUserMessage.includes("difficult")) {
            feedback += "Nice problem-solving mindset. Elaborate on your approach.";
        } else {
            feedback += "Show more personality and specific examples from your experience.";
        }
    }
    else if (isTechnicalQuestion) {
        feedback = "Technical Assessment: ";
        if (lastUserMessage.includes("code") || lastUserMessage.includes("algorithm")) {
            feedback += "Good technical thinking. Explain your reasoning clearly.";
        } else if (lastUserMessage.includes("system") || lastUserMessage.includes("design")) {
            feedback += "Solid approach. Consider scalability and trade-offs.";
        } else {
            feedback += "Break down your technical thought process step by step.";
        }
    }
    else if (isProbing) {
        feedback = "Deep dive: The interviewer wants more detail about your specific experience and approach.";
    }
    else {
        const tips = [
            "Balance technical skills with communication abilities.",
            "Show enthusiasm for both the role and the company.",
            "Demonstrate problem-solving with concrete examples."
        ];
        feedback = "Interview tip: " + tips[Math.floor(Math.random() * tips.length)];
    }
    
    // Add personalized elements
    if (lastUserMessage) {
        if (lastUserMessage.length < 30) {
            feedback += " Provide more detailed responses.";
        }
        if (!lastUserMessage.includes("I")) {
            feedback += " Focus on YOUR specific contributions and experiences.";
        }
    }
    
    return feedback.substring(0, 180);
}

module.exports = mockhr;