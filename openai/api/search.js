import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: "Which US state names begin with the letter C?",
    tools: [{
        type: "file_search",
        vector_store_ids: ["notyetcreated"],
    }],
});
console.log(response);
