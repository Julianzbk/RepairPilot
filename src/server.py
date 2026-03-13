from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from typing import List
import shutil
import tempfile
import os
from pathlib import Path

# Import your existing functions: build_index, expand_query, search_manual, generate_answer, chunks, index
from semantic_search import build_index, expand_query, search_manual, generate_answer   

# Initialize your FAISS index once
PDF_PATH = "examples/2015-q40-owner-manual.pdf"

app = FastAPI()

# Allow local React app to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/llm")
async def query_llm(
    prompt: str = Form(...),
    experience_level: str = Form("Beginner"),
    files: List[UploadFile] = File(default=[])
):
    """
    Accepts:
    - prompt: user's question
    - experience_level: Beginner / Intermediate / Expert
    - files: optional additional PDFs / text files
    """
    # Temporarily save uploaded files
    uploaded_docs = []
    for f in files:
        suffix = Path(f.filename).suffix
        tmp_file = Path(tempfile.gettempdir()) / f.filename
        with tmp_file.open("wb") as buffer:
            shutil.copyfileobj(f.file, buffer)
        uploaded_docs.append(tmp_file)

    # Combine main PDF and uploaded files for semantic search
    all_docs = uploaded_docs[0] # TODO: Parse every element instead of first

    # For simplicity, just use main index for now
    # Expand the user query
    expanded_query = expand_query(prompt)

    index, chunks = build_index(all_docs)
    # Retrieve top results
    results, top_score = search_manual(expanded_query, index, chunks)

    # Generate answer from LLM
    answer = generate_answer(prompt, results, experience_level)

    return JSONResponse({"text": answer})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")