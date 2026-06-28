import axios from "axios";
import {z} from "zod" 

const outputSchema = z.object({
    feedback : z.string().describe("Feedback for the user"),
    score : z.number().describe("score out of 10 for their interview ")
})


const RESULT_PROMPT = `You are an expert evaluator. Your job is to evaluate the users interview. Give them a score out of 10 and also let them know any feedback you have about thier interview. 
Please return only a json which looks like this - 
{
    feedback:string,
    score: number
}
DO NOT RETURN ANY OTHER TEXT, ONLY JSON.
{{USER_TRANSCRIPT }}

`

export async function calculteResult (messages: {type: "Assistant" | "User", message:string, createdAt: Date} [] )  {
    
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "user",
                content: RESULT_PROMPT.replace(`{{USER_TRANSCRIPT}}`, JSON.stringify(messages))
            }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    console.log(response.data.choices[0].message.content);
    const result = outputSchema.parse(JSON.parse(response.data.choices[0].message.content));
    return result
    
    // let data = JSON.stringify({
    //     "system_instrunction": {
    //         "parts" : [
    //             {
    //                 "text" : "you are a"
    //             }
    //         ]
    //     },
    //     "contents" : [
    //         {
    //             "parts" : [
    //                 {
    //                     "text" : ""
    //                 }
    //             ]
    //         }
    //     ]
    // });

    // let config = {
    //     method : 'POST',
    //     maxbodyLength : Infinity,
    //     url : 'https://generativelanguage.googleapis.com/v1beta/models/gemini3.5-flash:generatecontent',
    //     headers : {
    //         'x-goog-api-key' : process.env.GEMINI_KEY!,
    //         'Content-Type' : 'application/json',
    //     },
    //     data: data
    // };

    // axios.request(config)
    // .then((respnse) => {
    //     console.log(JSON.stringify(respnse.data))
    // })
    // .catch((error ) => {
    //     console.log(error)
    // })
}