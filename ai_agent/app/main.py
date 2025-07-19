from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

# Load environment variables from .env
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Set up Gemini LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-pro",
    google_api_key=GEMINI_API_KEY,
    temperature=0.7
)

# Set up LangChain prompt and chain
prompt = PromptTemplate.from_template("What is a good name for a company that makes {product}?")
chain = LLMChain(llm=llm, prompt=prompt)

app = FastAPI()

class Query(BaseModel):
    input: str

@app.post("/ask")
def ask(query: Query):
    result = chain.run(query.input)
    return {"response": result}

# Add a simple GET endpoint for testing
@app.get("/")
def read_root():
    return {"message": "LangChain Gemini API is running!"}

# Add health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}
