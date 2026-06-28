import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export function Result() {

    interface Result {
        transcript : {type: "Assistant" | "User", content : string, createdAt: Date }[],
        score : number,
        feedback : string,
        status : "Inprogress" | "Done" | "Pre"
    }

    const { interviewId } = useParams();
    const navigate = useNavigate();

    const [result, setResult] = useState <Result>({
        score: 0,
        feedback : "",
        transcript : [],
        status : "Pre"
    });


    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`).then(response => {
            setResult(response.data);
        })

        let intervalId = setInterval(() => {
            axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`).then(response => {
            setResult(response.data);
            if(response.data.status === "Done") {
                clearInterval(intervalId);
            }
        })
        }, 5*1000)
        return () => {
            clearInterval(intervalId);
        }
        
    }, [])

    const getScoreColor = (score: number) => {
        if (score >= 8) return "text-green-600 dark:text-green-400";
        if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
        return "text-red-600 dark:text-red-400";
    };

    return (
        <div className="min-h-screen w-screen bg-linear-to-br from-green-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {result.status === "Pre" || result.status === "Inprogress" ? (
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Processing Your Interview</h2>
                        <p className="text-gray-600 dark:text-gray-300">This may take a few moments...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Interview Results</h1>
                            <p className="text-gray-600 dark:text-gray-300">Here's your performance summary</p>
                        </div>

                        {/* Score Card */}
                        <Card className="bg-white dark:bg-gray-800">
                            <CardHeader>
                                <CardTitle className="text-2xl">Your Score</CardTitle>
                                <CardDescription>Overall performance rating</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center">
                                    <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
                                        {result.score}/10
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Feedback Card */}
                        <Card className="bg-white dark:bg-gray-800">
                            <CardHeader>
                                <CardTitle className="text-2xl">Feedback</CardTitle>
                                <CardDescription>Areas of strength and improvement</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {result.feedback}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Transcript Card */}
                        <Card className="bg-white dark:bg-gray-800">
                            <CardHeader>
                                <CardTitle className="text-2xl">Interview Transcript</CardTitle>
                                <CardDescription>Complete conversation history</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-125 overflow-y-auto">
                                    {result.transcript.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-lg ${
                                                msg.type === "User"
                                                    ? "bg-green-100 dark:bg-green-900/30 ml-8"
                                                    : "bg-blue-100 dark:bg-blue-900/30 mr-8"
                                            }`}
                                        >
                                            <div className="font-semibold text-sm mb-1">
                                                {msg.type === "User" ? "You" : "AI Interviewer"}
                                            </div>
                                            <div className="text-gray-700 dark:text-gray-300">
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex justify-center gap-4">
                            <Button 
                                onClick={() => navigate("/")}
                                className="px-8 py-6 text-base font-semibold"
                            >
                                Start New Interview
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}