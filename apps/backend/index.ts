import express from "express";
import { PreInterviewBody } from "./types";
import cors from "cors";
import { scrapreGithub } from "./scrapers/github";
import { prisma } from "./db";
import { initSideBand } from "./sideBand";
import { calculteResult } from "./result";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import WebSocket from "ws";

const app = express();
app.use(express.json());
app.use(cors())
app.use(express.text({type:["application.sdp", "text/plain"]}));



app.post("/api/v1/pre-interview", async (req, res) => {
    const {success, data} = PreInterviewBody.safeParse(req.body);
    if(!success) {
        return res.status(411).json({
            message:"Incorrect body"
        })
    }
    
    const githubUrl = data.github.endsWith("/") ? data.github.slice(0, -1): data.github ; // https://github.com/zakizaidi55
    const githubUserName = githubUrl.split("/").pop()

    // @ts-ignore
    const githubData = await scrapreGithub(githubUserName);
    const interview = await prisma.interview.create({
        data: {
            githubMetaData: JSON.stringify(githubData),
            status:"Pre"
        }
    })
    res.json({
        id: interview.id
    })
    
});

app.post("/api/v1/session/:interviewId", async (req, res) => {
    const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime-2",
    audio: { output: { voice: "marin" } },
    });
    const fd = new FormData();
    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    try {
        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_KEY}`,
            "OpenAI-Safety-Identifier": "hashed-user-id",
        },
        body: fd,
        });
        // Location: /v1/realtime/calls/rtc_123456
        const location = sdpResponse.headers.get("Location");
        const callId = location?.split("/").pop()!;
        console.log(callId);
        // Send back the SDP we received from the OpenAI REST API
        const sdp = await sdpResponse.text();
        res.send(sdp);
        initSideBand(callId, req.params.interviewId);
    } catch (error) {
        console.error("Token generation error:", error);
        res.status(500).json({ error: "Failed to generate token" });
    }

});

app.post("/api/v1/session/user/response/:interviewId", async(req, res)=> {
    const { message } = req.body;
    await prisma.message.create({
        data: {
            interviewId : req.params.interviewId,
            type: "User",
            message: message
        }
    })

    res.json({message: "Message saved"});
});

app.get("/api/v1/result/:interviewId", async (req, res) => {
    const interview = await prisma.interview.findFirst({
        where : {
            id: req.params.interviewId
        },
        include : {
            conversation : true
        }
    })

    if(!interview) {
        return res.json({
            message: "Interview not found"
        })
    }

    res.json({
        score: interview?.score,
        feedback:interview?.feedback,
        transcript : interview?.conversation.map(c => ({
            type: c.type,
            content: c.message,
            createdAt: c.createdAt
        })),
        status: interview.status
    })

    if(interview.status != "Done")  {
        const result = await calculteResult(interview.conversation);
        await prisma.interview.update({
            where : {
                id: req.params.interviewId
            },
            data : {
                status : "Done",
                feedback : result.feedback,
                score: result.score,
            }
        })
    }

})

// Create HTTP server from Express app
const server = createServer(app);

// WebSocket server for Deepgram proxy
const wss = new WebSocketServer({ server, path: '/api/v1/transcribe' });

wss.on('connection', (clientWs: WebSocket, req) => {
    console.log('Client connected to transcription service');
    
    // Extract interviewId from query params
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const interviewId = url.searchParams.get('interviewId');
    
    if (!interviewId) {
        clientWs.close(1008, 'Missing interviewId');
        return;
    }
    
    // Connect to Deepgram
    const deepgramWs = new WebSocket('wss://api.deepgram.com/v1/listen', {
        headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
        }
    });
    
    deepgramWs.on('open', () => {
        console.log('Connected to Deepgram');
    });
    
    // Forward audio data from client to Deepgram
    clientWs.on('message', (data) => {
        if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(data);
        }
    });
    
    // Forward transcription from Deepgram to client and save to DB
    deepgramWs.on('message', async (data) => {
        clientWs.send(data);
        
        // Parse and save transcript
        try {
            const result = JSON.parse(data.toString());
            const transcript = result.channel?.alternatives?.[0]?.transcript;
            
            if (transcript) {
                await prisma.message.create({
                    data: {
                        interviewId: interviewId,
                        type: "User",
                        message: transcript
                    }
                });
            }
        } catch (error) {
            console.error('Error processing transcript:', error);
        }
    });
    
    deepgramWs.on('error', (error) => {
        console.error('Deepgram error:', error);
        clientWs.close(1011, 'Deepgram connection error');
    });
    
    deepgramWs.on('close', () => {
        console.log('Deepgram connection closed');
        clientWs.close();
    });
    
    clientWs.on('close', () => {
        console.log('Client disconnected');
        if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.close();
        }
    });
    
    clientWs.on('error', (error) => {
        console.error('Client WebSocket error:', error);
        if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.close();
        }
    });
});

server.listen(3001, () => {
    console.log('Server listening on port 3001');
});