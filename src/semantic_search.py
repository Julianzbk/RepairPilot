import os
import fitz
import numpy as np
import faiss
from openai import OpenAI
from sentence_transformers import SentenceTransformer

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = "gpt-5-mini-2025-08-07"
CONFIDENCE_THRESHOLD = 0.35
TOP_K = 5

client = OpenAI(api_key=OPENAI_API_KEY)

"""
# EXTRACT TEXT PAGE BY PAGE
"""
# Path to the example manual (Ford Transit 2017)
PDF_PATH = "examples/2015-q40-owner-manual.pdf"

def extract_pages(pdf_path):
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            pages.append({"page": i + 1, "text": text})
    return pages

"""
#TEXT CHUNKING
"""
def chunk_pages(pages, chunk_size=450, overlap=80):
    chunks = []
    chunk_id = 0
    for page in pages:
        words = page["text"].split()
        start = 0
        while start < len(words):
            end = start + chunk_size
            chunk_text = " ".join(words[start:end])
            chunks.append({"chunk_id": chunk_id, "page": page["page"], "text": chunk_text})
            chunk_id += 1
            start += chunk_size - overlap
    return chunks

"""
# SEMANTIC EMBEDDINGS

"""
print("Loading embedding model...\n")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model loaded\n")

"""
# QUERY EXPANSION
"""

def expand_query(query):
    if not OPENAI_API_KEY:
        print("[expand_query] OPENAI_API_KEY is not set; using original query.")
        return query

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                     "content": (
                        "You are a technical assistant. Rewrite the user's query using "
                        "precise technical terminology that would appear in a vehicle owner's manual. "
                        "Return only the rewritten query, nothing else."
                    )
                },
                {"role": "user", "content": query}
            ],
            max_completion_tokens=500
        )
        expanded = response.choices[0].message.content.strip()
        if expanded == query:
            print("[expand_query] Model returned the same query.")
        return expanded if expanded else query
    except Exception as exc:
        print(f"[expand_query] Query expansion failed: {exc}")
        return query

"""
# RETRIEVAL
"""

def search_manual(query, index, chunks):
    query_vec = embedding_model.encode([query], convert_to_numpy=True)
    faiss.normalize_L2(query_vec)
    scores, indices = index.search(query_vec, TOP_K)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        results.append({
            "score": float(score),
            "page": chunks[idx]["page"],
            "text": chunks[idx]["text"][:500]
        })
    return results, float(scores[0][0])


def check_confidence(top_score):
    if top_score < CONFIDENCE_THRESHOLD:
        return True, (
            f"Low confidence (score: {top_score:.3f})"
            "the manual may not contain clear information about this topic."
        )
    return False, ""


"""
# RAG
"""
def generate_answer(original_query, results, experience_level):
    context = "\n\n".join([f"[Page {r['page']}]: {r['text']}" for r in results])

    level_instructions = {
        "Beginner":     "Explain in simple everyday language. Avoid technical terminology. Be reassuring.",
        "Intermediate": "Use a balanced explanation with some technical terms. Do not over-explain basics.",
        "Expert":       "Be concise and technical. Use precise automotive terminology."
    }

    system_prompt = f"""You are a vehicle owner's manual assistant. Answer based ONLY on the provided manual sections.
User experience level: {experience_level}
Tone/style: {level_instructions.get(experience_level, level_instructions['Beginner'])}

Structure your response in exactly this format:

-Explantion:
[Explain what the issue or warning likely indicates based on the manual. Include potential causes if the manual mentions them. Cite page numbers, e.g. "According to page 95..."]

-Instructions:
[Numbered steps the driver should take, drawn from the manual.]

-See a professional if...:
[Only include this section if the manual explicitly recommends professional service. Omit entirely if not mentioned.]

-Why these results:
[One sentence explaining why the retrieved manual sections are relevant to this question.]

Do NOT ask follow-up questions. Do NOT suggest contacting a dealer unless the manual explicitly says to."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {original_query}\n\nManual sections:\n{context}"}
        ],
        max_completion_tokens=4000
    )
    result = response.choices[0].message.content
    return result.strip() if result else "No answer generated."

"""
# BUILD INDEX 
"""

def build_index(pdf_path):
    print(f"\tLoading manual: {pdf_path}")
    pages = extract_pages(pdf_path)
    chunks = chunk_pages(pages)
    print(f" \t{len(pages)} pages extracted, {len(chunks)} chunks created")

    texts = [c["text"] for c in chunks]
    print("\tGenerating embeddings...")
    embeddings = embedding_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    faiss.normalize_L2(embeddings)

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    print(f"\tFAISS index built ({index.ntotal} vectors)\n")
    return index, chunks


"""
# TESTING 
"""

def run_example(index, chunks, query, experience_level):
    print("--- Stats ---")
    print(f"ORIGINAL QUERY   : {query}")
    print(f"EXPERIENCE LEVEL : {experience_level}")

    expanded = expand_query(query)
    print(f"EXPANDED QUERY   : {expanded}")

    results, top_score = search_manual(expanded, index, chunks)
    low_conf, warning = check_confidence(top_score)

    print(f"TOP SCORE        : {top_score:.3f}  {'LOW CONFIDENCE' if low_conf else ''}")
    sources_str = ', '.join([f"Page {r['page']} ({r['score']:.3f})" for r in results])
    print(f"TOP SOURCES      : {sources_str}")

    if low_conf:
        print(f"\n{warning}")

    print("\n--- LLM Response ---")
    answer = generate_answer(query, results, experience_level)
    print(answer)
    print()

if __name__ == "__main__":
    index, chunks = build_index(PDF_PATH)

    run_example(index, chunks,
        query="how do I check and add engine oil",
        experience_level="Beginner"
    )
