
from llama_index.readers.web import SimpleWebPageReader
from llama_index.core import Document
from fastapi import FastAPI

# Create FastAPI app
app = FastAPI(title="Data Extraction Microservice", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Data Extraction Microservice is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/extract/web")
async def extract_web_data(url: str = "https://developers.llamaindex.ai/python/framework-api-reference/readers/telegram/"):
    """Extract data from a web page"""
    try:
        reader = SimpleWebPageReader()
        documents = reader.load_data([url])
        
        # Return the first document's text (simplified for demo)
        if documents:
            return {
                "status": "success",
                "url": url,
                "text_preview": documents[0].text[:500] + "..." if len(documents[0].text) > 500 else documents[0].text,
                "text": documents[0].text,
                "full_length": len(documents[0].text)
            }
        else:
            return {"status": "error", "message": "No documents extracted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def prototype():
    """Prototype function for testing"""
    reader = SimpleWebPageReader()
    documents = reader.load_data(["https://developers.llamaindex.ai/python/framework-api-reference/readers/telegram/"])

    for doc in documents:
        print(doc.text[:200] + "..." if len(doc.text) > 200 else doc.text)

# Entry point for the data extraction microservice
def main():
    prototype()
    print("Data Extraction Microservice started.")

if __name__ == "__main__":
    main()
