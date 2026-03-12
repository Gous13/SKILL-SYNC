"""
NLP Service using Sentence-BERT for semantic encoding
"""

import json
import numpy as np
import os
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Singleton instance
_nlp_service_instance = None

def get_nlp_service(model_name='all-MiniLM-L6-v2'):
    """Get singleton NLP service instance"""
    global _nlp_service_instance
    
    if _nlp_service_instance is None:
        _nlp_service_instance = NLPService(model_name)
    
    return _nlp_service_instance

class NLPService:
    """Service for NLP operations using Sentence-BERT"""
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """
        Initialize Sentence-BERT model
        Using a lightweight model suitable for academic deployment
        """
        import warnings
        import logging
        
        # Suppress HuggingFace warnings about network timeouts
        logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
        warnings.filterwarnings('ignore', category=UserWarning)
        
        print(f"Loading Sentence-BERT model: {model_name}")
        try:
            # Load model - it will use cache if available
            # Network errors are expected if offline, but cached model should work
            self.model = SentenceTransformer(model_name, device='cpu')
            print("Model loaded successfully")
        except Exception as e:
            error_msg = str(e)
            # Check if it's just a network timeout (model might still be usable)
            if 'timeout' in error_msg.lower() or 'resolve' in error_msg.lower() or 'connection' in error_msg.lower():
                print("Network timeout detected, but model may still be loaded from cache.")
                print("Model should work for encoding. If errors occur, check model cache.")
                # Model might still be loaded, try to use it
                try:
                    # Check if model was actually loaded despite the error
                    if hasattr(self, 'model') and self.model is not None:
                        print("Using cached model instance.")
                    else:
                        raise
                except:
                    print(f"Warning: Model loading had network issues: {error_msg}")
                    print("The application will continue, but NLP features may not work until model is loaded.")
                    raise Exception("NLP model failed to load. Please check internet connection for first-time download, or ensure model is cached.")
            else:
                raise
    
    def encode_text(self, text):
        """
        Encode text into vector embedding
        
        Args:
            text: String to encode
            
        Returns:
            numpy array of embeddings
        """
        if not text or not text.strip():
            # Return zero vector if text is empty
            return np.zeros(self.model.get_sentence_embedding_dimension())
        
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding
    
    def encode_texts(self, texts):
        """
        Encode multiple texts into embeddings
        
        Args:
            texts: List of strings to encode
            
        Returns:
            numpy array of embeddings
        """
        if not texts:
            return np.array([])
        
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return embeddings
    
    def compute_similarity(self, embedding1, embedding2):
        """
        Compute cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding (numpy array or list)
            embedding2: Second embedding (numpy array or list)
            
        Returns:
            float: Cosine similarity score (0-1)
        """
        if isinstance(embedding1, str):
            embedding1 = json.loads(embedding1)
        if isinstance(embedding2, str):
            embedding2 = json.loads(embedding2)
        
        embedding1 = np.array(embedding1).reshape(1, -1)
        embedding2 = np.array(embedding2).reshape(1, -1)
        
        similarity = cosine_similarity(embedding1, embedding2)[0][0]
        # Normalize to 0-1 range (cosine similarity is already -1 to 1, but typically 0-1)
        similarity = max(0, min(1, (similarity + 1) / 2))
        return float(similarity)
    
    def compute_similarities(self, query_embedding, candidate_embeddings):
        """
        Compute similarities between query and multiple candidates
        
        Args:
            query_embedding: Query embedding
            candidate_embeddings: List of candidate embeddings
            
        Returns:
            numpy array of similarity scores
        """
        if isinstance(query_embedding, str):
            query_embedding = json.loads(query_embedding)
        
        query_embedding = np.array(query_embedding).reshape(1, -1)
        
        candidate_list = []
        for emb in candidate_embeddings:
            if isinstance(emb, str):
                emb = json.loads(emb)
            candidate_list.append(emb)
        
        candidate_array = np.array(candidate_list)
        
        similarities = cosine_similarity(query_embedding, candidate_array)[0]
        # Normalize to 0-1 range
        similarities = np.clip((similarities + 1) / 2, 0, 1)
        return similarities
    
    def extract_keywords(self, text, top_n=10):
        """
        Extract keywords from text (simple implementation)
        For a more sophisticated approach, could use spaCy or similar
        
        Args:
            text: Input text
            top_n: Number of keywords to return
            
        Returns:
            List of keywords
        """
        # Simple keyword extraction - split by common delimiters
        import re
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Remove common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'}
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        # Count frequency
        from collections import Counter
        keyword_counts = Counter(keywords)
        
        return [word for word, count in keyword_counts.most_common(top_n)]
