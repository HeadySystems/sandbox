#!/bin/bash
# Heady Research Paper Downloader
# Auto-generated 2026-03-07

mkdir -p research_papers

echo "Downloading academic papers for Heady Patent System..."

# Function to download with retry
download_paper() {
    local url="$1"
    local filename="$2"
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        echo "Downloading: $filename"
        if curl -L -f -o "research_papers/$filename" "$url"; then
            echo "✓ Success: $filename"
            return 0
        else
            retry=$((retry + 1))
            echo "× Failed (attempt $retry/$max_retries)"
            sleep 2
        fi
    done
    echo "⚠ Skipped: $filename (download failed)"
    return 1
}


# Continuous Semantic Logic & Vector Spaces
download_paper "https://proceedings.kr.org/2020/7/kr2020-0007-aspis-et-al.pdf" "001_Stable_and_Supported_Semantics_in_Continuous_Vecto.pdf"
download_paper "https://www.arxiv.org/pdf/2602.02940.pdf" "002_A_vector_logic_for_intensional_formal_semantics.pdf"

# Semantic Vector Embeddings
download_paper "https://arxiv.org/pdf/2211.08142.pdf" "005_Semantic_Representations_of_Mathematical_Expressio.pdf"
download_paper "https://aclanthology.org/W14-1503.pdf" "007_A_Systematic_Study_of_Semantic_Vector_Space_Model_.pdf"
download_paper "https://aclanthology.org/P14-1046.pdf" "008_Interpretable_Semantic_Vectors_from_a_Joint_Model_.pdf"
download_paper "https://aclanthology.org/P14-6005.pdf" "009_New_Directions_in_Vector_Space_Models_of_Meaning.pdf"
download_paper "https://www.aclweb.org/anthology/N15-1164.pdf" "010_Embedding_a_Semantic_Network_in_a_Word_Space.pdf"

# Monte Carlo Methods for Detection & Sampling

# Golden Ratio & Phi-Based Optimization

# Patent Prior Art Detection & Novelty
download_paper "http://arxiv.org/pdf/2404.19360.pdf" "019_Large_Language_Model_Informed_Patent_Image_Retriev.pdf"
download_paper "https://arxiv.org/pdf/2012.13919.pdf" "020_PatentMatch_A_Dataset_for_Matching_Patent_Claims_&.pdf"
download_paper "https://arxiv.org/pdf/2502.06316.pdf" "021_Can_AI_Examine_Novelty_of_Patents_Novelty_Evaluati.pdf"
download_paper "https://arxiv.org/pdf/1901.03136.pdf" "022_Automating_the_search_for_a_patent's_prior_art_wit.pdf"
download_paper "https://arxiv.org/pdf/2009.09132.pdf" "023_Prior_Art_Search_and_Reranking_for_Generated_Paten.pdf"
download_paper "https://downloads.hindawi.com/journals/misy/2021/2497770.pdf" "024_PQPS_Prior-Art_Query-Based_Patent_Summarizer_Using.pdf"
download_paper "http://arxiv.org/pdf/2407.07923.pdf" "025_New_Method_for_Keyword_Extraction_for_Patent_Claim.pdf"

# Deterministic AI Orchestration

# Cosine Similarity & Birkhoff-von Neumann Theory
download_paper "https://arxiv.org/pdf/2010.05984.pdf" "030_An_Extension_of_the_Birkhoff-von_Neumann_Theorem_t.pdf"

echo "\nDownload complete! Papers saved to research_papers/"
echo "Total papers: $(ls research_papers/*.pdf 2>/dev/null | wc -l)"