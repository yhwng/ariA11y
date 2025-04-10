
import os  
import openai
import dotenv
from flask import Flask, request
import json

dotenv.load_dotenv()

openai_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
openai_key = os.environ.get("AZURE_OPENAI_API_KEY")
openai_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_ID")
search_endpoint = os.environ.get("AZURE_AI_SEARCH_ENDPOINT")
search_key = os.environ.get("AZURE_AI_SEARCH_API_KEY")
search_index = os.environ.get("AZURE_AI_SEARCH_INDEX")

app = Flask(__name__)

def generate_with_rag(chat_prompt, system_message):

    client = openai.AzureOpenAI(  
        azure_endpoint = openai_endpoint,  
        api_key = openai_key,  
        api_version = "2024-08-01-preview",  
    )

    return client.chat.completions.create(  
        model=openai_deployment,  
        messages=chat_prompt, 
        seed=42, 
        max_tokens=16384,  
        temperature=0.3,  
        top_p=0.95,   
        extra_body={
        "data_sources": [{
            "type": "azure_search",
            "parameters": {
                "endpoint": search_endpoint,
                "index_name": search_index,
                "semantic_configuration": "default",
                "query_type": "vector_semantic_hybrid",
                "in_scope": True,
                "role_information": system_message,
                "strictness": 3,
                "top_n_documents": 5,
                "authentication": {
                "type": "api_key",
                "key": search_key
                },
                "embedding_dependency": {
                "type": "deployment_name",
                "deployment_name": "text-embedding-ada-002"
                }
            }
            }]
        }
    )

def generate_without_rag(chat_prompt):

    client = openai.AzureOpenAI(  
        azure_endpoint = openai_endpoint,  
        api_key = openai_key,  
        api_version = "2024-08-01-preview",  
    )

    return client.chat.completions.create(  
        model=openai_deployment,  
        messages=chat_prompt, 
        seed=42, 
        max_tokens=16384,  
        temperature=0.3,  
        top_p=0.95
    )

@app.post("/code")
def code():

    data = request.json

    user_message = data["message"]
    rag = data["rag"]

    print("Received message:", user_message[:100])  # Log the first 100 characters
    print("RAG:", rag)

    system_message = """
        You are an intelligent assistant that helps people to identify web accessibility issues.
        You will be given a code snippet which may or may not contain web accessibility issues.
        Your task is to analyze the code snippet and determine if it containes any web accessibility issues based on the Web Content Accessibility Guidelines (WCAG) 2.2. A code snippet may contain multiple issues.
        - If an issue is found, you should return the errorneous code snippet, state which Success Criteria it does not fulfill based on WCAG 2.2, and describe the issue found. Then, suggest a fix and provide a corrected code snippet. You must list the source for each fact you use, after the word 'Learn More'. Separate each error snippet as 1 list item. Separate each full response as 1 list item. Do not trim whitespaces.
        - If no issue is found, you should return an empty string as code snippet. You do no need to provide any description, fixes, nor sources in this case.
        If you cannot answer using the sources, say you don't know. Do not use any external sources.
        Use 'you' to refer to the individual asking the questions even if they ask with 'I'.
        Use below example to answer. Follow the same format strictly. Do not return answer in json.

        USER MESSAGE:
        '<label>Username<input autocomplete="badname"/></label>'

        ANSWER:
        {
            "error_snippets": ["<p style="color: #AAA; background: white;">\nSome text in English\n</p>"],
            "full_responses": ["#### Issues Found\nThe code snippet does not fulfil WCAG Success Criterion **1.4.3 Contrast (Minimum)**.\nThe text color is set to #AAA (light gray), which does not provide sufficient contrast against a white background. This can make the text difficult to read for users with visual impairments or low vision.\n#### Proposed Fix\nChange the text color to a darker shade that provides sufficient contrast against the white background. For example, using a color like #333333 would improve readability.\n```\n<p style=\"color: #333333; background: white;\">Some text in English</p>\n```\n#### Learn More\n- https://www.w3.org/WAI/standards-guidelines/act/rules/afw4f7/"]
        }

        USER MESSAGE:
        '<label>Username<input autocomplete="username"/></label>'

        ANSWER:
        {
            "error_snippets": [""],
            "full_responses": ["No issues found."]
        }
    """

    chat_prompt = [
        {
            "role": "system",
            "content": system_message
        },
        {   
            "role": "user",
            "content": user_message
        }
    ]  
        
    # Generate the completion  
    try:
        completion = generate_with_rag(chat_prompt, system_message) if rag else generate_without_rag(chat_prompt)

        ai_response = completion.choices[0].message.content
        print("AI Response:", ai_response)  
        
        return json.loads(ai_response, strict=False)

    except Exception as e:
        print("Error in backend:", e)
        return {"error": str(e)}, 500

@app.post("/chat")
def chat():
    
    data = request.json

    user_message = data["message"]
    rag = data["rag"]

    print("Received message:", user_message[:100])  # Log the first 100 characters
    print("RAG:", rag)

    system_message = """
        You are an intelligent assistant that helps people to understand web accessibility.
        Your task is to answer questions related to web accessibility based on the Web Content Accessibility Guidelines (WCAG) 2.2. You must list the source for each fact you use, after the word 'Learn More'. 
        If you cannot answer using the sources, say you don't know. Do not use any external sources.
        Use 'you' to refer to the individual asking the questions even if they ask with 'I'.

        USER MESSAGE:
        'What is success criterion 1.4.3?'

        ANSWER:
        'Success Criterion 1.4.3, titled "Contrast (Minimum)," requires that the contrast ratio between text (and images of text) and its background must be at least 4.5:1 for normal text and 3:1 for large text (18pt and larger or 14pt bold) to ensure sufficient visibility for users with visual impairments.\nThis criterion is essential for improving the readability of text on web pages, allowing users with low vision or color deficiencies to access content more effectively . If the contrast ratio does not meet these requirements, it can lead to accessibility issues, making it difficult for some users to read the text.\n#### Learn More\n- https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
    """

    chat_prompt = [
        {
            "role": "system",
            "content": system_message
        },
        {   
            "role": "user",
            "content": user_message
        }
    ]  
        
    # Generate the completion  
    try:
        completion = generate_with_rag(chat_prompt, system_message) if rag else generate_without_rag(chat_prompt)

        ai_response = completion.choices[0].message.content
        print("AI Response:", ai_response)  
        
        return ai_response

    except Exception as e:
        print("Error in backend:", e)
        return {"error": str(e)}, 500