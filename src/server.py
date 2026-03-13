from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import shutil
import os

# Import your existing functions: build_index, expand_query, search_manual, generate_answer, chunks, index
from semantic_search import build_index, expand_query, search_manual, generate_answer

app = FastAPI()

# Allow local React app to communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize your FAISS index once
PDF_PATH = "examples/2015-q40-owner-manual.pdf"
index, chunks = build_index(PDF_PATH)

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

    # Save uploaded files to temporary directory and build index if needed
    for f in files:
        temp_path = f"/tmp/{f.filename}"
        with open(temp_path, "wb") as out_file:
            shutil.copyfileobj(f.file, out_file)
        # Optionally, you could build index on these files and merge with main index
        # new_index, new_chunks = build_index(temp_path)
        # merge_indices(index, new_index)
        # chunks.extend(new_chunks)
        # For simplicity, we'll ignore additional files for now

    # Expand the query
    expanded = expand_query(prompt)

    # Search FAISS index
    results, top_score = search_manual(expanded, index, chunks)

    # Generate LLM answer
    answer = generate_answer(prompt, results, experience_level)

    return {"text": answer}