
import os  
import openai
import dotenv
from flask import Flask, request

dotenv.load_dotenv()

openai_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
openai_key = os.environ.get("AZURE_OPENAI_API_KEY")
openai_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_ID")
search_endpoint = os.environ.get("AZURE_AI_SEARCH_ENDPOINT")
search_key = os.environ.get("AZURE_AI_SEARCH_API_KEY")
search_index = os.environ.get("AZURE_AI_SEARCH_INDEX")

app = Flask(__name__)

@app.post("/search")
def search():

    data = request.json

    client = openai.AzureOpenAI(  
        azure_endpoint = openai_endpoint,  
        api_key = openai_key,  
        api_version = "2024-08-01-preview",  
    )

    system_message = """
        You are an intelligent assistant that helps people to identify web accessibility issues.
        You will be given a code snippet which may or may not contain web accessibility issues.
        Your task is to analyze the code snippet and determine if it containes any web accessibility issues based on the Web Content Accessibility Guidelines (WCAG) 2.2.
        - If an issue is found, you should state which Success Criteria it does not fulfill based on WCAG 2.2 and describe the issue found. Then, suggest a fix and provide a corrected code snippet. You must list the source for each fact you use, after the word 'Learn More'.
        - If no issue is found, you should say so. You do no need to provide any further description, fixes, nor sources in this case.
        If you cannot answer using the sources, say you don't know. Do not use any external sources.
        Use 'you' to refer to the individual asking the questions even if they ask with 'I'.
        Use below example to answer. Follow the same format strictly.

        USER MESSAGE:
        '<label>Username<input autocomplete="badname"/></label>'

        ANSWER:
        #### Issues Found
        The code snippet does not fulfil WCAG Success Criterion **1.3.5 Identify Input Purpose**.\n
        The value of the autocomplete attribute is set to "badname", which is not a valid value according to the HTML specification. The autocomplete attribute is intended to assist users by suggesting previously entered values, and using a non-standard value could confuse assistive technologies and users.
        #### Proposed Fix
        Change the autocomplete attribute to a valid value that corresponds to the type of information being entered. For a username field, you might want to use autocomplete="username".
        ```
        <label>Username<input autocomplete="username"/></label>
        ```
        #### Learn More
        - https://www.w3.org/WAI/standards-guidelines/act/rules/73f2c2/
        """

    user_message = data["message"]

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
    completion = client.chat.completions.create(  
        model=openai_deployment,  
        messages=chat_prompt,  
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
                "strictness": 1,
                "top_n_documents": 20,
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

    return completion.choices[0].message.content
    