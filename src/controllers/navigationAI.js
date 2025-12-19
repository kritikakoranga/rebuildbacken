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

const getNavigationPrompt = (message, currentPage) => `
You are a helpful navigation assistant for the "Re:Build" coding platform. You help users navigate to different pages by understanding their requests and responding naturally.

Current page: ${currentPage || 'unknown'}
User wants: "${message}"

Available pages you can navigate to:
- Home/Dashboard (/home)
- Problems (/problems)
- Data Structures (/data-structures)
- Algorithms (/algorithms)
- Practice Hub (/practice)
- DSA Practice with AI (/practice/dsa-with-ai)
- Behavioral Interview Practice (/practice/behavioral-with-ai)
- System Design Practice (/practice/system-design-with-ai)
- Mock HR Interview (/practice/mock-hr-technical)
- Contest (/contest)
- Leaderboard (/leaderboard)
- Profile (/profile)
- Admin Panel (/admin)
- Admin Update (/admin/update)
- Admin Create (/admin/create)
- Admin Create (/admin/delete)
- Admin Video (/Admin/video)
  - Sorting Visualizer (/sorting-visualizer)
- Searching Visualizer (/searching-visualizer)
- Graph Visualizer (/graph-visualizer)
- Tree Visualizer (/tree-visualizer)
 - Nqueen Visualizer (/nqueens-visualizer)
 - Blog (/blog)
- Guides (/guides)
- FAQ (/faq)
- Sudoku Visualizer (/sudoku-visualizer)
- Stack Visualizer (/stack-visualizer)
- Queue Visualizer (/queue-visualizer)
-- Visualize (/visualize)

Instructions:
- If the user wants to navigate somewhere, respond with: "NAVIGATE:/route/path:Taking you to [Page Name]!"
- If they ask for help or general questions, respond normally and helpfully
- Be friendly and conversational
- Don't use JSON format, use the NAVIGATE: format shown above

Examples:
- "take me to problems" → "NAVIGATE:/problems:Taking you to Problems!"
- "go to dsa practice" → "NAVIGATE:/practice/dsa-with-ai:Taking you to DSA Practice with AI!"
- "show me contests" → "NAVIGATE:/contest:Taking you to Contest!"
- "what pages are available?" → "I can help you navigate to Problems, Practice, Contest, Leaderboard, Profile, and more! Just tell me where you want to go."
`;

const navigationAssistant = async (req, res) => {
    try {
        const { message, currentPage } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY6 });

        const conversationHistory = [
            {
                role: 'user',
                parts: [{ text: message }]
            }
        ];

        const systemInstruction = {
            systemInstruction: getNavigationPrompt(message, currentPage)
        };

        // SSE Streaming
        if (req.headers.accept?.includes('text/event-stream')) {
            res.set({
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.flushHeaders();

            const finalResponse = await streamGeminiResponse(ai, { 
                contents: conversationHistory, 
                config: systemInstruction 
            }, (chunk) => {
                res.write(`data: ${chunk}\n\n`);
            });
            
            // Try to parse and send final navigation data
            try {
                const parsedResponse = JSON.parse(finalResponse);
                if (parsedResponse.action === 'navigate') {
                    res.write(`data: ${JSON.stringify(parsedResponse)}\n\n`);
                }
            } catch (e) {
                // Not JSON, that's fine
            }
            
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

        let aiResponse = response.text || "";

        // Parse navigation response
        let parsedResponse;
        if (aiResponse.startsWith('NAVIGATE:')) {
            // Parse the NAVIGATE format: "NAVIGATE:/route/path:Message"
            const parts = aiResponse.split(':');
            if (parts.length >= 3) {
                const route = parts[1];
                const message = parts.slice(2).join(':');
                parsedResponse = {
                    action: 'navigate',
                    route: route,
                    message: message
                };
            } else {
                parsedResponse = {
                    action: 'message',
                    message: aiResponse
                };
            }
        } else {
            // Regular text response
            parsedResponse = {
                action: 'message',
                message: aiResponse
            };
        }

        // Enhanced route matching as fallback
        if (parsedResponse.action !== 'navigate') {
            const lowerMessage = message.toLowerCase();
            let foundRoute = null;
            let pageName = '';
            
            // Main pages
            if (lowerMessage.includes('home') || lowerMessage.includes('dashboard')) {
                foundRoute = '/home';
                pageName = 'Home';
            } else if (lowerMessage.includes('problem') && !lowerMessage.includes('practice')) {
                foundRoute = '/problems';
                pageName = 'Problems';
            } 
            // Practice pages
            else if (lowerMessage.includes('dsa') && lowerMessage.includes('practice')) {
                foundRoute = '/practice/dsa-with-ai';
                pageName = 'DSA Practice with AI';
            } else if (lowerMessage.includes('behavioral') && lowerMessage.includes('practice')) {
                foundRoute = '/practice/behavioral-with-ai';
                pageName = 'Behavioral Interview Practice';
            } else if (lowerMessage.includes('system design') && lowerMessage.includes('practice')) {
                foundRoute = '/practice/system-design-with-ai';
                pageName = 'System Design Practice';
            } else if (lowerMessage.includes('mock') && lowerMessage.includes('hr')) {
                foundRoute = '/practice/mock-hr-technical';
                pageName = 'Mock HR Interview';
            } else if (lowerMessage.includes('practice')) {
                foundRoute = '/practice';
                pageName = 'Practice Hub';
            }
            // Other pages
            else if (lowerMessage.includes('data structure')) {
                foundRoute = '/data-structures';
                pageName = 'Data Structures';
            } else if (lowerMessage.includes('algorithm')) {
                foundRoute = '/algorithms';
                pageName = 'Algorithms';
            } else if (lowerMessage.includes('contest')) {
                foundRoute = '/contest';
                pageName = 'Contest';
            } else if (lowerMessage.includes('leaderboard') || lowerMessage.includes('ranking')) {
                foundRoute = '/leaderboard';
                pageName = 'Leaderboard';
            } else if (lowerMessage.includes('profile')) {
                foundRoute = '/profile';
                pageName = 'Profile';
            } else if (lowerMessage.includes('admin')) {
                foundRoute = '/admin';
                pageName = 'Admin Panel';
            } else if (lowerMessage.includes('blog')) {
                foundRoute = '/blog';
                pageName = 'Blog';
            } else if (lowerMessage.includes('guide')) {
                foundRoute = '/guides';
                pageName = 'Guides';
            } else if (lowerMessage.includes('faq')) {
                foundRoute = '/faq';
                pageName = 'FAQ';
            }
            
            if (foundRoute) {
                parsedResponse = {
                    action: 'navigate',
                    route: foundRoute,
                    message: `Taking you to ${pageName}!`
                };
            }
        }

        res.json(parsedResponse);

    } catch (error) {
        console.error('Navigation AI error:', error);
        
        // Human-like error response similar to DSA practice
        const errorResponses = [
            "I'm having trouble understanding that request. Could you try rephrasing?",
            "Let me think about that... Could you be more specific about where you want to go?",
            "Hmm, I need a moment to process that. Where exactly would you like to navigate?"
        ];
        
        res.status(500).json({
            action: 'message',
            message: errorResponses[Math.floor(Math.random() * errorResponses.length)]
        });
    }
};

module.exports = {
  navigationAssistant
};