import { useState } from "react"
import "../../../styles/globals.css"
import { Button } from "./button"
import { Input } from "./input"
import {toast} from "sonner"
import axios from "axios"
import { BACKEND_URL } from "@/lib/config"
import { useNavigate } from "react-router"

export function Form() {
    const [github, setGithub] = useState("")
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate();

    async function onSubmit() {
        if(!github ) {
            toast.error("Please provide a valid GitHub URL")
            return
        }

        setLoading(true)
        try {
            const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
                github
            })
            toast.success("Starting your interview...")
            navigate(`/interview/${response.data.id}`)
        } catch (error) {
            toast.error("Failed to start interview. Please try again.")
            setLoading(false)
        }
    }

    return (
        <div className="h-screen w-screen flex flex-col justify-center items-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="w-full max-w-md px-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">AI Interview</h1>
                    <p className="text-gray-600 dark:text-gray-300">Enter your GitHub profile to begin your technical interview</p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">GitHub URL</label>
                        <Input 
                            placeholder="https://github.com/username" 
                            onChange={e => setGithub(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            className="h-12 text-base"
                            disabled={loading}
                        />
                    </div>

                    <Button 
                        onClick={onSubmit} 
                        className="w-full h-12 text-base font-semibold"
                        disabled={loading}
                    >
                        {loading ? "Starting..." : "Start Interview"}
                    </Button>
                </div>
            </div>
        </div>
    )
}