import { BACKEND_URL } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router"
import axios from "axios";
import { Button } from "./ui/button";

export function Interview() {
    const { interviewId } = useParams();
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const [userVolume, setUserVolume] = useState(0);
    const [aiVolume, setAiVolume] = useState(0);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const navigate = useNavigate();
    const deepgramApiKey = process.env.BUN_PUBLIC_DEEPGRAM_API_KEY;

    const toggleMute = () => {
        if (mediaStreamRef.current) {
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const endInterview = async () => {
        setIsEnding(true);
        
        // Cleanup all connections
        try {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (websocketRef.current) {
                websocketRef.current.close();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
        
        // Small delay to ensure cleanup completes
        setTimeout(() => {
            navigate(`/result/${interviewId}`);
        }, 500);
    };

    useEffect(() => {
        let animationFrame: number;
        
        (async() => {
            // Create a peer connection
            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            // Set up to play remote audio from the model
            audioRef.current = document.createElement("audio");
            audioRef.current.autoplay = true;
            
            // Audio visualization for AI
            pc.ontrack = (e) => {
                audioRef.current!.srcObject = e.streams[0]!;
                
                const audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(e.streams[0]!);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                const updateAiVolume = () => {
                    analyser.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    setAiVolume(average);
                    setIsAiSpeaking(average > 10);
                    animationFrame = requestAnimationFrame(updateAiVolume);
                };
                updateAiVolume();
            };

            // Add local audio track for microphone input in the browser
            const ms = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaStreamRef.current = ms;
            
            // Start muted
            const audioTrack = ms.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = false;
            }
            
            // Audio visualization for user
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(ms);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);
            
            const userDataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            
            const updateUserVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(userDataArray);
                const average = userDataArray.reduce((a, b) => a + b) / userDataArray.length;
                setUserVolume(average);
                setIsUserSpeaking(average > 20);
                animationFrame = requestAnimationFrame(updateUserVolume);
            };
            updateUserVolume();
            
            if (!deepgramApiKey) {
                console.error('Missing BUN_PUBLIC_DEEPGRAM_API_KEY in frontend environment.');
                return;
            }

            const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
                'token',
                deepgramApiKey
            ]);
            websocketRef.current = socket;
            
            socket.onopen = () => {
                const mediaRecorder = new MediaRecorder(ms, {mimeType: 'audio/webm'});
                mediaRecorder.start(250);
                mediaRecorder.addEventListener('dataavailable', (event)=> {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(event.data);
                    }
                })
            }

            socket.onmessage = (message) => {
                const data = JSON.parse(message.data);
                const transcript = data.channel.alternatives[0].transcript;
                if(transcript) {
                    axios.post(`${BACKEND_URL}/api/v1/session/user/response/${interviewId}`, {
                        message:transcript
                    })
                }
            };

            pc.addTrack(ms.getTracks()[0]!);

            // Start the session using the Session Description Protocol (SDP)
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpResponse = await fetch(`${BACKEND_URL}/api/v1/session/${interviewId}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    "Content-Type": "application/sdp",
                },
            });
            
            const answer = {
                type: "answer" as "answer",
                sdp: await sdpResponse.text(),
            };
            await pc.setRemoteDescription(answer);
        })()
        
        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (websocketRef.current) {
                websocketRef.current.close();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(e => console.error('Error closing audio context:', e));
            }
        };
    }, [deepgramApiKey, interviewId])

    const getVolumeDots = (volume: number) => {
        const normalizedVolume = Math.min(volume / 50, 1);
        const activeDots = Math.floor(normalizedVolume * 5);
        return activeDots;
    };

    return (
        <div className="h-screen w-screen flex flex-col justify-center items-center bg-black">
            <audio autoPlay ref={audioRef}></audio>
            
            {/* Loading Overlay */}
            {isEnding && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mb-4 mx-auto"></div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Ending Interview</h2>
                        <p className="text-gray-400">Processing your results...</p>
                    </div>
                </div>
            )}
            
            <div className="w-full max-w-6xl px-8">
                <div className="grid grid-cols-2 gap-16">
                    {/* AI Interviewer Circle */}
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            {/* Concentric rings */}
                            <div className={`absolute inset-0 rounded-full border-2 border-blue-500/20 transition-all duration-300 ${isAiSpeaking ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`} style={{ animation: isAiSpeaking ? 'pulse 1.5s ease-out infinite' : 'none' }}></div>
                            <div className={`absolute inset-0 rounded-full border-2 border-blue-500/30 transition-all duration-300 delay-100 ${isAiSpeaking ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`} style={{ animation: isAiSpeaking ? 'pulse 1.5s ease-out infinite 0.2s' : 'none' }}></div>
                            
                            {/* Main circle */}
                            <div className={`relative w-64 h-64 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center transition-all duration-300 ${isAiSpeaking ? 'scale-110 shadow-2xl shadow-blue-500/50' : 'scale-100'}`}>
                                {/* Robot Icon */}
                                <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Volume dots */}
                        <div className="flex gap-2 mt-8">
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full transition-all duration-200 ${
                                        i < getVolumeDots(aiVolume)
                                            ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                                            : 'bg-gray-700'
                                    }`}
                                />
                            ))}
                        </div>
                        
                        {/* Label */}
                        <div className="mt-6 text-center">
                            <h3 className="text-2xl font-semibold text-white mb-1">Interviewer</h3>
                            <p className="text-gray-400">
                                {isAiSpeaking ? 'Speaking...' : 'Listening'}
                            </p>
                        </div>
                    </div>

                    {/* User Circle */}
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            {/* Concentric rings */}
                            <div className={`absolute inset-0 rounded-full border-2 ${isMuted ? 'border-red-500/20' : 'border-green-500/20'} transition-all duration-300 ${isUserSpeaking && !isMuted ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`} style={{ animation: isUserSpeaking && !isMuted ? 'pulse 1.5s ease-out infinite' : 'none' }}></div>
                            <div className={`absolute inset-0 rounded-full border-2 ${isMuted ? 'border-red-500/30' : 'border-green-500/30'} transition-all duration-300 delay-100 ${isUserSpeaking && !isMuted ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`} style={{ animation: isUserSpeaking && !isMuted ? 'pulse 1.5s ease-out infinite 0.2s' : 'none' }}></div>
                            
                            {/* Main circle */}
                            <div className={`relative w-64 h-64 rounded-full ${isMuted ? 'bg-linear-to-br from-red-400 to-red-600' : 'bg-linear-to-br from-green-400 to-teal-500'} flex items-center justify-center transition-all duration-300 ${isUserSpeaking && !isMuted ? 'scale-110 shadow-2xl shadow-green-500/50' : 'scale-100'}`}>
                                {/* User Icon */}
                                <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                
                                {/* Muted indicator */}
                                {isMuted && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-red-600 rounded-full p-3 animate-pulse">
                                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Volume dots */}
                        <div className="flex gap-2 mt-8">
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full transition-all duration-200 ${
                                        i < getVolumeDots(userVolume) && !isMuted
                                            ? 'bg-green-500 shadow-lg shadow-green-500/50'
                                            : 'bg-gray-700'
                                    }`}
                                />
                            ))}
                        </div>
                        
                        {/* Label */}
                        <div className="mt-6 text-center">
                            <h3 className="text-2xl font-semibold text-white mb-1">You</h3>
                            <p className={`${isMuted ? 'text-red-400' : 'text-gray-400'}`}>
                                {isMuted ? 'Muted' : isUserSpeaking ? 'Speaking...' : 'Listening'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-16 flex justify-center gap-6">
                    <Button 
                        onClick={toggleMute}
                        variant={isMuted ? "default" : "secondary"}
                        className="px-10 py-6 text-lg font-semibold"
                        disabled={isEnding}
                    >
                        {isMuted ? (
                            <>
                                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                                Unmute to Start
                            </>
                        ) : (
                            <>
                                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                                Mute
                            </>
                        )}
                    </Button>
                    <Button 
                        onClick={endInterview}
                        variant="destructive"
                        className="px-10 py-6 text-lg font-semibold"
                        disabled={isEnding}
                    >
                        {isEnding ? 'Ending...' : 'End Interview'}
                    </Button>
                </div>
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    )
}