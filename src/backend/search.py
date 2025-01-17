
import os  
import openai
import dotenv
from flask import Flask, request
import re

dotenv.load_dotenv()

openai_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
openai_key = os.environ.get("AZURE_OPENAI_API_KEY")
openai_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_ID")
search_endpoint = os.environ.get("AZURE_AI_SEARCH_ENDPOINT")
search_key = os.environ.get("AZURE_AI_SEARCH_API_KEY")
search_index = os.environ.get("AZURE_AI_SEARCH_INDEX")

app = Flask(__name__)

# Helper function to extract issues and ranges
def parse_ai_response(ai_response, user_message):
    issues = []
    lines = user_message.split("\n")


    # Split the AI response into sections
    sections = ai_response.split("#### Issues Found")
    if len(sections) > 1:
        issue_lines = sections[1].strip().split("\n")
        
        for line in issue_lines:
            # Match line and column numbers using regex
            match = re.match(r"\d+\.\s+Line (\d+), Column (\d+): (.+)", line.strip())


            if match:
                start_line = int(match.group(1))  # Extract start line
                start_column = int(match.group(2))  # Extract start column
                description = match.group(3).strip()  # Extract issue description

                # Assume end column is start_column + 10 (currently this is supposed to hardcode highlight max 10 chars but i changed sth and now idk why it doesnt work)
                end_line = start_line
                end_column = start_column + 10

                issues.append({
                    "description": description,
                    "start_line": start_line,
                    "start_column": start_column,
                    "end_line": end_line,
                    "end_column": end_column,
                })

    return issues

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
        Your task is to analyze the code snippet and determine if it contains any web accessibility issues based on WCAG 2.2 guidelines.

        Instructions for your answer:

        A) If you detect accessibility issues, follow this structured format:

        1. Always use the section heading:
        #### Issues Found

        2. List each issue on its own line, with a leading number, followed by:
        `Line <lineNumber>, Column <columnNumber>: <Issue Description>`

        For example:
        1. Line 8, Column 12: The `alt` attribute is missing.
        2. Line 24, Column 4: The `autocomplete` attribute is invalid.

        3. After listing the issues, give a short summary explaining which WCAG Success Criteria these issues do not fulfill, and why.

        4. Then write:
        #### Proposed Fix

        5. Explain how to fix each issue, and show a corrected code snippet.

        6. Finally, write:
        #### Learn More
        - https://www.w3.org/WAI/standards-guidelines/act/rules/73f2c2/
        and then list official WCAG or W3 references as bullet points.

        B) If no accessibility issues are found, simply state that no issues were detected. Do not include fix suggestions or references.

        C) Follow-up Questions: If the developer asks further questions, whether about the code snippet or general accessibility, respond naturally and conversationally. Use their code and relevant WCAG Success Criteria as needed, but ignore the strict reporting format described above for such questions. Refer to the developer as "you" and tailor your explanation to their query.

        D) Stay concise and clear in all responses. Never deviate from the structured format unless explicitly asked a question that requires a conversational response.
        
        Use 'you' to refer to the developer. Never deviate from the exact format above.
        """

    ####### Backup
    # system_message = """
    #     You are an intelligent assistant that helps people to identify web accessibility issues.
    #     You will be given a code snippet which may or may not contain web accessibility issues.
    #     Your task is to analyze the code snippet and determine if it containes any web accessibility issues based on the Web Content Accessibility Guidelines (WCAG) 2.2.
        
 
    #     - If an issue is found, you should state which Success Criteria it does not fulfill based on WCAG 2.2 and describe the issue found. Then, suggest a fix and provide a corrected code snippet. You must list the source for each fact you use, after the word 'Learn More'.
    #     - If no issue is found, you should say so. You do no need to provide any further description, fixes, nor sources in this case.
        
    #     Use 'you' to refer to the individual asking the questions even if they ask with 'I'.
    #     Use below example to answer. Follow the same format as much as possible, and switch out the values in the line and column based on the placement of the issue in the code, and change the issues found based on which Success Criteria it does not fulfill.

    #     USER MESSAGE:
    #     '<label>Username<input autocomplete="badname"/></label>'

    #     ANSWER:
    #     #### Issues Found

    #     1. Line 5, Column 12: The `alt` attribute is missing from `<img>` tag
    #     2. Line 10, Column 4: The `autocomplete` attribute is invalid

    #     The code snippet does not fulfil WCAG Success Criterion **1.3.5 Identify Input Purpose**.\n
    #     The value of the autocomplete attribute is set to "badname", which is not a valid value according to the HTML specification. The autocomplete attribute is intended to assist users by suggesting previously entered values, and using a non-standard value could confuse assistive technologies and users.
    #     #### Proposed Fix
    #     Change the autocomplete attribute to a valid value that corresponds to the type of information being entered. For a username field, you might want to use autocomplete="username".
    #     ```
    #     <label>Username<input autocomplete="username"/></label>
    #     ```
    #     #### Learn More
    #     - https://www.w3.org/WAI/standards-guidelines/act/rules/73f2c2/
    #     """

    user_message = data["message"]
    print("Received file content:", user_message[:100])  # Log the first 100 characters


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
                    "in_scope": False,
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

        # AI response text
        ai_response = completion.choices[0].message.content
        print("AI Response:", ai_response)  # Log the full AI response


        # Extract issues and ranges
        issues = parse_ai_response(ai_response, user_message)
        print("Parsed Issues:", issues)  # Log the parsed issues


        # Return both the raw AI response and extracted issues
        return {
            "ai_response": ai_response,
            "issues": issues
        }
    except Exception as e:
        print("Error in backend:", e)
        return {"error": str(e)}, 500

    