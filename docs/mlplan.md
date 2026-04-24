Table of Contents

Mini Doctor: ML Implementation Plan
Complete Technical Guide for AI/ML Components
Document Version: 1.0
Project: Mini Doctor - AI Health Companion
Target Platform: Android Application
Languages Supported: Hindi, English, Hinglish
________________________________________
Table of Contents
1.	Executive Summary
2.	System Architecture Overview
3.	Component 1: Symptom Extractor
4.	Component 2: Disease Classifier
5.	Component 3: Severity Classifier
6.	Component 4: Remedy Retriever (RAG)
7.	Component 5: Response Generator
8.	Data Flow and Integration
9.	Phase-wise Implementation Plan
10.	Technical Stack Summary
11.	Cost Estimates
12.	Appendix: Code Examples
________________________________________
1. Executive Summary
Project Overview
Mini Doctor is an AI-powered health companion app that helps users understand their symptoms, assess severity, and get home remedy recommendations through natural conversation in Hindi, English, or Hinglish.
Core ML Components
The application consists of five main ML components:
Component	Purpose	Model Type
Symptom Extractor	Extract symptoms from natural language	NLP/NER
Disease Classifier	Predict possible diseases	Classification
Severity Classifier	Assess Normal/Mild/Serious	Classification
Remedy Retriever	Find relevant home remedies	RAG System
Response Generator	Generate natural responses	LLM/Templates
Key Design Principles
1.	Safety First: Always err on the side of caution for medical conditions
2.	Multilingual: Support Hindi, English, and code-mixed Hinglish
3.	Phased Approach: Start simple, improve iteratively
4.	Transparency: Always include disclaimers and confidence levels
________________________________________
2. System Architecture Overview
High-Level Architecture
┌─────────────────────────────────────────────────────────────┐
│                     USER INPUT                              │
│         "mujhe kal se sir mein dard hai aur bukhar"        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 1: SYMPTOM EXTRACTOR                 │
│                     (NLP/NER Model)                         │
│                                                             │
│  Input:  Raw text (Hindi/English/Hinglish)                 │
│  Output: {symptoms: ["headache", "fever"],                 │
│           duration: "1 day",                                │
│           body_parts: ["head"]}                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 2: DISEASE CLASSIFIER                │
│                  (Classification Model)                     │
│                                                             │
│  Input:  Extracted symptoms                                │
│  Output: {diseases: ["Common Cold", "Viral Fever"],        │
│           confidence: [0.75, 0.60]}                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 3: SEVERITY CLASSIFIER               │
│                  (Classification Model)                     │
│                                                             │
│  Input:  Symptoms + disease prediction                     │
│  Output: {severity: "Mild",                                │
│           confidence: 0.82,                                 │
│           urgent: false}                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 4: REMEDY RETRIEVER                  │
│                     (RAG System)                            │
│                                                             │
│  Input:  Symptoms + disease                                │
│  Output: {remedies: ["Drink warm water with honey",        │
│                      "Take rest", "Steam inhalation"],     │
│           sources: ["Ayurveda", "WHO Guidelines"]}         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPONENT 5: RESPONSE GENERATOR                │
│                   (LLM / Conversation)                      │
│                                                             │
│  Input:  All above outputs + conversation history          │
│  Output: Natural language response in user's language      │
└─────────────────────────────────────────────────────────────┘
Data Flow Summary
USER INPUT
    │
    ▼
Language Detection → Symptom Extraction → Disease Prediction
    │                                            │
    │                                            ▼
    │                                    Severity Assessment
    │                                            │
    │                                            ▼
    │                                    Remedy Retrieval
    │                                            │
    └────────────────────────────────────────────┤
                                                 ▼
                                        Response Generation
                                                 │
                                                 ▼
                                          USER RESPONSE
________________________________________
3. Component 1: Symptom Extractor
Purpose
Convert messy, multilingual user text into structured symptom data that can be processed by downstream models.
Input/Output Specification
Input:
Raw text: "mere pet mein dard ho raha hai 2 din se"
Output:
{
    "symptoms": ["stomach pain", "abdominal pain"],
    "duration": {
        "value": 2,
        "unit": "days"
    },
    "body_parts": ["stomach", "abdomen"],
    "severity_keywords": [],
    "language_detected": "hinglish",
    "confidence": 0.85
}
Processing Pipeline
Step 1: Language Detection
Input: "mere pet mein dard ho raha hai"

Detection Logic:
- Check for Devanagari script → Hindi
- Check for Latin script with Hindi words → Hinglish
- Pure English → English

Output: "hinglish"
Step 2: Transliteration and Normalization
Hindi/Hinglish Terms → English Medical Terms

Mapping Examples:
- "pet" → "stomach"
- "dard" → "pain"
- "bukhar" → "fever"
- "sir" → "head"
- "khansi" → "cough"
- "ulti" → "vomiting"
- "dast" → "diarrhea"
- "chakkar" → "dizziness"
Step 3: Entity Extraction (NER)
Entities to Extract:
- SYMPTOM: Medical symptoms
- BODY_PART: Affected body parts
- DURATION: Time duration
- SEVERITY: Severity indicators (mild, severe, etc.)
- FREQUENCY: How often symptoms occur
Step 4: Symptom Standardization
User Input Variations → Standard Symptom

"head pain" → "headache"
"head ache" → "headache"
"sir dard" → "headache"
"my head hurts" → "headache"
Model Options
Approach	Complexity	Accuracy	Cost	Best For
Rule-based (spaCy Matcher)	Low	60-70%	Free	Phase 1 MVP
Fine-tuned BERT NER	Medium	80-85%	Training cost	Phase 2
LLM with prompting	Low	85-90%	API cost	Quick deployment
Custom MuRIL NER	High	90%+	High training	Phase 3
Recommended Implementation
Phase 1: Rule-Based + Dictionary
# Symptom Dictionary Structure
symptom_dictionary = {
    "headache": {
        "variations": ["head pain", "head ache", "sir dard", "sir mein dard"],
        "body_part": "head",
        "category": "neurological"
    },
    "fever": {
        "variations": ["bukhar", "temperature", "taap", "badan garam"],
        "body_part": "whole body",
        "category": "general"
    },
    # ... 500+ symptoms
}
Phase 2: Add LLM Fallback
def extract_symptoms(text):
    # Try rule-based first
    symptoms = rule_based_extraction(text)
    
    # If low confidence, use LLM
    if symptoms.confidence < 0.6:
        symptoms = llm_extraction(text)
    
    return symptoms
Symptom Dictionary Requirements
Category	Count	Examples
General	50+	Fever, fatigue, weakness
Respiratory	40+	Cough, cold, breathlessness
Digestive	40+	Stomach pain, nausea, diarrhea
Neurological	30+	Headache, dizziness, numbness
Musculoskeletal	30+	Back pain, joint pain
Skin	25+	Rash, itching, swelling
Cardiovascular	20+	Chest pain, palpitations
Others	50+	Various symptoms
Total	300+	
Hindi-English Mapping (Sample)
English	Hindi (Devanagari)	Hindi (Romanized)
Fever	बुखार	bukhar
Headache	सिर दर्द	sir dard
Cough	खांसी	khansi
Cold	जुकाम	zukam
Stomach pain	पेट दर्द	pet dard
Vomiting	उल्टी	ulti
Diarrhea	दस्त	dast
Dizziness	चक्कर	chakkar
Body pain	बदन दर्द	badan dard
Weakness	कमजोरी	kamzori
________________________________________
4. Component 2: Disease Classifier
Purpose
Predict possible disease categories based on extracted symptoms.
Input/Output Specification
Input:
{
    "symptoms": ["fever", "headache", "body pain", "fatigue"],
    "duration": {"value": 2, "unit": "days"}
}
Output:
{
    "predictions": [
        {"disease": "Viral Fever", "confidence": 0.78, "category": "Infectious"},
        {"disease": "Dengue", "confidence": 0.45, "category": "Infectious"},
        {"disease": "Common Cold", "confidence": 0.35, "category": "Respiratory"}
    ],
    "top_prediction": "Viral Fever",
    "requires_attention": false
}
Model Architecture
Feature Engineering
Input: List of symptoms

Step 1: One-Hot Encoding
symptoms = ["fever", "headache", "body_pain"]
features = [1, 1, 1, 0, 0, 0, ...] (length = total unique symptoms)

Step 2: Additional Features
- symptom_count: 3
- has_critical_symptom: 0
- duration_days: 2
- severity_score: 0.4

Step 3: Final Feature Vector
[1, 1, 1, 0, 0, ..., 3, 0, 2, 0.4]
Model Options Comparison
Model	Training Data	Accuracy	Speed	Memory
Logistic Regression	5K+	65-70%	Very Fast	Low
Random Forest	10K+	70-75%	Fast	Medium
XGBoost	10K+	75-80%	Fast	Medium
Neural Network	50K+	80-85%	Medium	High
Fine-tuned BERT	50K+	85-90%	Slow	Very High
Recommended: XGBoost
Why XGBoost: - Good accuracy without massive data - Fast inference for mobile - Handles imbalanced classes well - Easy to interpret feature importance
Model Configuration:
model_params = {
    "objective": "multi:softprob",
    "num_class": num_diseases,
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "scale_pos_weight": "balanced"
}
Training Data Requirements
Dataset Structure
| symptom_1 | symptom_2 | symptom_3 | ... | disease |
|-----------|-----------|-----------|-----|---------|
| 1         | 1         | 0         | ... | Viral Fever |
| 0         | 1         | 1         | ... | Common Cold |
| 1         | 0         | 1         | ... | Dengue |
Data Sources
Source	Type	Size	Quality
Kaggle Disease-Symptom	Public	10K+	Medium
Symptom2Disease	Public	5K+	Medium
MIMIC-III	Clinical (restricted)	100K+	High
Custom Labeled	Manual	Varies	High
Minimum Requirements
Phase	Training Samples	Diseases	Symptoms
Phase 1	10,000+	50+	100+
Phase 2	50,000+	100+	200+
Phase 3	100,000+	200+	300+
Evaluation Metrics
Metric	Target (Phase 1)	Target (Phase 3)
Top-1 Accuracy	65%+	80%+
Top-3 Accuracy	80%+	95%+
Precision (macro)	60%+	75%+
Recall (macro)	60%+	75%+
Output Rules
1.	Confidence Threshold: Only show diseases with >35% confidence
2.	Maximum Predictions: Show top 3 predictions maximum
3.	Category Labeling: Group by disease category
4.	Uncertainty Handling: If top confidence <50%, add disclaimer
________________________________________
5. Component 3: Severity Classifier
Purpose
Assess the severity of the user’s condition as Normal, Mild, or Serious to guide appropriate action.
Input/Output Specification
Input:
{
    "symptoms": ["chest pain", "breathlessness"],
    "duration": {"value": 30, "unit": "minutes"},
    "predicted_disease": "Unknown",
    "disease_confidence": 0.3,
    "user_age": 45,
    "user_gender": "male"
}
Output:
{
    "severity": "Serious",
    "confidence": 0.95,
    "reasoning": "Chest pain with breathlessness requires immediate attention",
    "action": "Seek immediate medical attention. Call emergency services if needed.",
    "emergency": true,
    "emergency_number": "108"
}
Severity Levels
Level	Description	Action Required
Normal	Common, self-limiting condition	Home care sufficient
Mild	Needs attention but not urgent	Home remedies + monitor
Serious	Requires medical consultation	See doctor soon
Emergency	Life-threatening	Call emergency services
Critical Symptoms (Hard Rules)
These symptoms ALWAYS trigger Serious/Emergency regardless of ML prediction:
Emergency (Call 108 immediately)
Symptom	Condition
Chest pain + breathlessness	Possible heart attack
Sudden severe headache	Possible stroke
Difficulty breathing	Respiratory emergency
Uncontrolled bleeding	Trauma
Loss of consciousness	Multiple causes
Severe allergic reaction	Anaphylaxis
Paralysis or numbness (sudden)	Stroke
Seizures	Neurological emergency
Serious (See doctor within 24 hours)
Symptom	Condition
High fever (>103°F) for >2 days	Infection
Severe abdominal pain	Multiple causes
Blood in stool/urine	Internal bleeding
Persistent vomiting (>24 hours)	Dehydration risk
Difficulty swallowing	Obstruction
Severe dehydration signs	Fluid loss
Model Architecture
Feature Engineering
features = {
    # Symptom-based
    "symptom_count": 2,
    "has_critical_symptom": 1,
    "critical_symptom_count": 2,
    
    # Duration-based
    "duration_hours": 0.5,
    "is_acute": 1,  # <24 hours
    "is_chronic": 0,  # >2 weeks
    
    # Severity keywords
    "severity_keyword_score": 0.8,  # "severe", "extreme", etc.
    
    # Disease prediction
    "disease_confidence": 0.3,
    "disease_severity_prior": 0.7,  # Known severity of predicted disease
    
    # User factors (if available)
    "age_risk_factor": 0.6,  # Higher for elderly
    "has_comorbidities": 0  # Diabetes, heart disease, etc.
}
Classification Logic
Step 1: Check Emergency Rules
        → If ANY emergency symptom → Return EMERGENCY

Step 2: Check Serious Rules
        → If ANY serious symptom → Return SERIOUS

Step 3: ML Classification
        → If no hard rules triggered, use ML model

Step 4: Safety Adjustment
        → If ML says Normal but confidence <70% → Upgrade to Mild
        → If ML says Mild but confidence <60% → Upgrade to Serious
Safety-First Design Principles
1.	Bias Toward Caution: When uncertain, classify as more serious
2.	Hard Rules Override ML: Critical symptoms always trigger alerts
3.	Low Threshold for Serious: Better to be cautious than miss something
4.	Clear Action Guidance: Always tell user what to do next
5.	Emergency Integration: Provide emergency numbers when needed
Model Training
Class Distribution Strategy
Training Data Distribution:
- Normal: 50%
- Mild: 30%
- Serious: 15%
- Emergency: 5%

Handling Imbalance:
- Use class weights
- SMOTE oversampling for minority classes
- Stratified train-test split
Evaluation Focus
Metric	Priority	Target
Recall for Serious/Emergency	Highest	>95%
Precision for Normal	High	>80%
Overall Accuracy	Medium	>75%
False Negative Rate (Serious)	Critical	<5%
________________________________________
6. Component 4: Remedy Retriever (RAG)
Purpose
Retrieve relevant, safe home remedies from a curated database based on symptoms and predicted condition.
RAG Architecture
┌─────────────────┐     ┌─────────────────┐
│  Remedy Database │     │  User Query     │
│  (500+ remedies) │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Embedding Model │     │ Embedding Model │
│ (sentence-bert) │     │ (sentence-bert) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Vector Store   │ ←── │  Similarity     │
│  (ChromaDB)     │     │  Search         │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Safety Filter  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Top K Results  │
│  + LLM Summary  │
└─────────────────┘
Input/Output Specification
Input:
{
    "symptoms": ["cough", "sore throat", "mild fever"],
    "disease": "Common Cold",
    "severity": "Mild",
    "user_allergies": ["honey"],
    "user_conditions": []
}
Output:
{
    "remedies": [
        {
            "name": "Ginger Tea",
            "description": "Boil fresh ginger in water for 10 minutes. Add lemon juice. Drink warm 2-3 times daily.",
            "ingredients": ["ginger", "water", "lemon"],
            "benefits": "Reduces throat inflammation, boosts immunity",
            "source": "Traditional Ayurveda",
            "safety": "Safe for most adults",
            "contraindications": ["pregnancy - consult doctor"],
            "confidence": 0.92
        },
        {
            "name": "Salt Water Gargle",
            "description": "Mix 1/2 teaspoon salt in warm water. Gargle for 30 seconds, 3-4 times daily.",
            "ingredients": ["salt", "warm water"],
            "benefits": "Reduces throat pain, kills bacteria",
            "source": "WHO Guidelines",
            "safety": "Safe for all ages above 6",
            "contraindications": [],
            "confidence": 0.89
        }
    ],
    "avoided_remedies": [
        {
            "name": "Honey Lemon Water",
            "reason": "User allergic to honey"
        }
    ],
    "disclaimer": "These are traditional remedies. Consult a doctor if symptoms persist beyond 3 days."
}
Remedy Database Structure
Database Schema
{
    "id": "remedy_001",
    "name": "Ginger Tea",
    "name_hindi": "अदरक की चाय",
    
    "conditions": ["common cold", "cough", "sore throat", "flu"],
    "symptoms": ["cough", "sore throat", "congestion", "mild fever"],
    
    "description": "Boil fresh ginger in water...",
    "description_hindi": "ताजा अदरक को पानी में उबालें...",
    
    "ingredients": [
        {"name": "ginger", "amount": "1 inch piece", "required": true},
        {"name": "water", "amount": "1 cup", "required": true},
        {"name": "lemon", "amount": "few drops", "required": false},
        {"name": "honey", "amount": "1 tsp", "required": false}
    ],
    
    "preparation_steps": [
        "Peel and slice fresh ginger",
        "Boil water with ginger for 10 minutes",
        "Strain and add lemon juice",
        "Add honey if desired (optional)"
    ],
    
    "dosage": "2-3 cups per day",
    "duration": "Continue for 3-5 days",
    
    "source": "Traditional Ayurveda",
    "evidence_level": "Traditional use, some clinical studies",
    
    "safety": {
        "general": "Safe for most adults",
        "children": "Safe for children above 2 years (without honey)",
        "pregnancy": "Consult doctor before use",
        "elderly": "Safe"
    },
    
    "contraindications": [
        "Blood thinning medications",
        "Gallbladder problems",
        "Honey: Not for children under 1 year"
    ],
    
    "allergens": ["honey (optional ingredient)"],
    
    "effectiveness": "moderate",
    "popularity": "high",
    
    "embedding": [0.12, -0.45, 0.78, ...]
}
Remedy Categories
Category	Count	Examples
Respiratory	80+	Cough syrups, steam, gargles
Digestive	70+	Ginger, mint, ajwain
Pain Relief	50+	Turmeric milk, hot compress
Fever	30+	Cool compress, fluids
Skin	40+	Aloe vera, neem
General Wellness	50+	Kadha, immunity boosters
Total	300+	
Retrieval Process
Step 1: Query Formation
def create_search_query(symptoms, disease, severity):
    query = f"home remedies for {', '.join(symptoms)}"
    if disease:
        query += f" {disease}"
    if severity == "Mild":
        query += " natural treatment"
    return query
Step 2: Vector Search
# Generate query embedding
query_embedding = embedding_model.encode(query)

# Search vector database
results = vector_db.similarity_search(
    query_embedding,
    k=10,  # Get top 10 candidates
    threshold=0.5  # Minimum similarity
)
Step 3: Safety Filtering
def filter_safe_remedies(remedies, user_profile):
    safe_remedies = []
    avoided = []
    
    for remedy in remedies:
        # Check allergies
        if has_allergen_conflict(remedy, user_profile.allergies):
            avoided.append({"remedy": remedy, "reason": "allergen"})
            continue
        
        # Check contraindications
        if has_contraindication(remedy, user_profile.conditions):
            avoided.append({"remedy": remedy, "reason": "contraindication"})
            continue
        
        # Check age appropriateness
        if not age_appropriate(remedy, user_profile.age):
            avoided.append({"remedy": remedy, "reason": "age"})
            continue
        
        safe_remedies.append(remedy)
    
    return safe_remedies, avoided
Step 4: Ranking and Selection
def rank_remedies(remedies, symptoms):
    for remedy in remedies:
        # Symptom match score
        symptom_score = len(set(remedy.symptoms) & set(symptoms)) / len(symptoms)
        
        # Source credibility score
        source_score = source_credibility[remedy.source]
        
        # Popularity score
        popularity_score = remedy.popularity_normalized
        
        # Final score
        remedy.final_score = (
            0.5 * symptom_score +
            0.3 * source_score +
            0.2 * popularity_score
        )
    
    return sorted(remedies, key=lambda x: x.final_score, reverse=True)[:5]
Vector Database Options
Database	Cost	Ease of Use	Performance	Best For
ChromaDB	Free	Very Easy	Good	Development, small scale
Pinecone	Paid	Easy	Excellent	Production, scalability
Weaviate	Free/Paid	Medium	Good	Self-hosted
Qdrant	Free/Paid	Medium	Excellent	High performance
Recommended: ChromaDB (Phase 1) → Pinecone (Phase 2+)
________________________________________
7. Component 5: Response Generator
Purpose
Generate natural, helpful, and safe responses in the user’s preferred language.
Two Implementation Approaches
Approach A: Template-Based (Phase 1)
Pros: Safe, predictable, fast, no API costs
Cons: Less natural, limited flexibility
Approach B: LLM-Based (Phase 2+)
Pros: Natural conversation, context-aware, multilingual
Cons: API costs, requires guardrails
Template-Based Implementation
Response Templates
RESPONSE_TEMPLATES = {
    "en": {
        "greeting": "Hello! I'm Mini Doctor, your health companion. How can I help you today?",
        
        "analysis_result": """
Based on your symptoms ({symptoms}), it appears you might have {disease}.

**Severity Assessment:** {severity}

**Recommended Home Remedies:**
{remedies}

**What to do next:**
{action}

⚠️ **Disclaimer:** This is for informational purposes only. Please consult a healthcare professional for proper diagnosis and treatment.
        """,
        
        "emergency": """
⚠️ **URGENT: Please seek immediate medical attention!**

Your symptoms ({symptoms}) may indicate a serious condition that requires immediate medical care.

**Actions to take:**
1. Call emergency services: 108
2. Go to the nearest hospital immediately
3. Do not delay seeking help

If you're with someone, ask them to help you get medical attention.
        """,
        
        "followup": "Is there anything specific you'd like to know more about?"
    },
    
    "hi": {
        "greeting": "नमस्ते! मैं मिनी डॉक्टर हूं, आपका स्वास्थ्य सहायक। आज मैं आपकी कैसे मदद कर सकता हूं?",
        
        "analysis_result": """
आपके लक्षणों ({symptoms}) के आधार पर, आपको {disease} हो सकता है।

**गंभीरता:** {severity}

**घरेलू उपचार:**
{remedies}

**आगे क्या करें:**
{action}

⚠️ **अस्वीकरण:** यह केवल जानकारी के लिए है। कृपया उचित निदान और उपचार के लिए डॉक्टर से परामर्श करें।
        """,
        
        "emergency": """
⚠️ **तुरंत चिकित्सा सहायता लें!**

आपके लक्षण ({symptoms}) गंभीर स्थिति का संकेत हो सकते हैं।

**क्या करें:**
1. आपातकालीन सेवाओं को कॉल करें: 108
2. तुरंत नजदीकी अस्पताल जाएं
3. देरी न करें

अगर कोई आपके साथ है, तो उनसे मदद लें।
        """
    }
}
Template Filling Logic
def generate_response_template(analysis, language="en"):
    template = RESPONSE_TEMPLATES[language]
    
    if analysis.emergency:
        return template["emergency"].format(
            symptoms=", ".join(analysis.symptoms)
        )
    
    # Format remedies list
    remedies_text = "\n".join([
        f"• {r.name}: {r.description}" 
        for r in analysis.remedies[:3]
    ])
    
    # Get action based on severity
    action = get_action_text(analysis.severity, language)
    
    return template["analysis_result"].format(
        symptoms=", ".join(analysis.symptoms),
        disease=analysis.top_disease,
        severity=analysis.severity,
        remedies=remedies_text,
        action=action
    )
LLM-Based Implementation
System Prompt
You are Mini Doctor, a friendly and caring AI health assistant designed for Indian users.

Your responsibilities:
1. Provide health information in a warm, reassuring tone
2. Respond in the user's language (Hindi, English, or Hinglish)
3. Always include appropriate disclaimers
4. Never diagnose - only suggest possibilities
5. Recommend professional help for serious conditions
6. Provide culturally appropriate home remedies

Guidelines:
- Use simple, easy-to-understand language
- Be empathetic and supportive
- Avoid medical jargon
- Always err on the side of caution
- Include emergency numbers when needed (108 for ambulance)

You must NEVER:
- Prescribe medications
- Provide dosage information for medicines
- Discourage users from seeing doctors
- Make definitive diagnoses
- Ignore serious symptoms
Context Injection
def generate_response_llm(analysis, conversation_history, language):
    
    context = f"""
    Analysis Results:
    - Detected Symptoms: {analysis.symptoms}
    - Predicted Condition: {analysis.disease} (Confidence: {analysis.confidence})
    - Severity: {analysis.severity}
    - Recommended Remedies: {[r.name for r in analysis.remedies]}
    
    User's Language: {language}
    Previous Conversation: {conversation_history[-3:]}  # Last 3 turns
    """
    
    prompt = f"""
    {context}
    
    Generate a helpful, caring response for the user. Include:
    1. Acknowledgment of their symptoms
    2. Brief explanation of the possible condition
    3. Home remedy recommendations (from the provided list)
    4. Appropriate next steps
    5. Disclaimer
    
    Respond in {language}.
    """
    
    response = llm_api.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=prompt,
        temperature=0.7,
        max_tokens=500
    )
    
    return response
Safety Guardrails
def apply_safety_guardrails(response, analysis):
    
    # Check for emergency - ensure emergency info is included
    if analysis.emergency:
        if "108" not in response:
            response += "\n\n⚠️ Emergency: Please call 108 immediately."
    
    # Check disclaimer is present
    if "disclaimer" not in response.lower() and "अस्वीकरण" not in response:
        response += "\n\n" + DISCLAIMER_TEXT[analysis.language]
    
    # Remove any medicine names/dosages
    response = remove_medicine_mentions(response)
    
    # Ensure no definitive diagnosis language
    response = soften_diagnostic_language(response)
    
    return response
________________________________________
8. Data Flow and Integration
Complete Request Flow
┌──────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                               │
│  "mujhe 2 din se bukhar hai aur sir mein bahut dard hai"        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    1. PREPROCESSING                               │
│  • Language Detection: Hinglish                                  │
│  • Text Normalization: lowercase, remove special chars           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                 2. SYMPTOM EXTRACTION                             │
│  Input: "mujhe 2 din se bukhar hai aur sir mein bahut dard hai" │
│  Output: {                                                        │
│    symptoms: ["fever", "headache"],                              │
│    duration: {value: 2, unit: "days"},                           │
│    severity_words: ["bahut" → "severe"]                          │
│  }                                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                3. DISEASE CLASSIFICATION                          │
│  Input: ["fever", "headache"], duration: 2 days                  │
│  Output: {                                                        │
│    predictions: [                                                 │
│      {disease: "Viral Fever", confidence: 0.72},                 │
│      {disease: "Common Cold", confidence: 0.45}                  │
│    ]                                                              │
│  }                                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                4. SEVERITY ASSESSMENT                             │
│  Input: symptoms + disease + duration + severity_words           │
│  Processing:                                                      │
│    • No critical symptoms detected                               │
│    • Duration: 2 days (not prolonged)                            │
│    • Severity words: "bahut" indicates discomfort                │
│  Output: {                                                        │
│    severity: "Mild",                                             │
│    confidence: 0.78,                                             │
│    action: "Home care with monitoring"                           │
│  }                                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                 5. REMEDY RETRIEVAL                               │
│  Query: "home remedies fever headache viral fever"               │
│  Vector Search → Top 5 matches                                   │
│  Safety Filter → Remove contraindicated                          │
│  Output: [                                                        │
│    {name: "Ginger Tea", confidence: 0.89},                       │
│    {name: "Turmeric Milk", confidence: 0.85},                    │
│    {name: "Rest and Fluids", confidence: 0.82}                   │
│  ]                                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                6. RESPONSE GENERATION                             │
│  Compile all results → Generate natural response                 │
│  Apply safety guardrails → Add disclaimer                        │
│  Translate to user's language (Hinglish)                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FINAL RESPONSE                               │
│                                                                   │
│  "Aapke symptoms (bukhar, sir dard) se lagta hai ki aapko       │
│   Viral Fever ho sakta hai. Yeh mild condition hai.              │
│                                                                   │
│   Ghar par kya karein:                                           │
│   • Adrak ki chai piyein - din mein 2-3 baar                    │
│   • Haldi wala doodh raat ko                                     │
│   • Aaram karein aur paani zyada piyein                         │
│                                                                   │
│   Agar 3 din mein better na ho, doctor se milein.               │
│                                                                   │
│   ⚠️ Yeh sirf jaankari hai. Doctor ki salah zaroor lein."       │
└──────────────────────────────────────────────────────────────────┘
API Integration Structure
# Main orchestrator function
async def process_health_query(user_input: str, user_profile: dict, conversation_history: list):
    
    # Step 1: Symptom Extraction
    extraction_result = await symptom_extractor.extract(user_input)
    
    # Step 2: Disease Classification
    disease_result = await disease_classifier.predict(
        symptoms=extraction_result.symptoms,
        duration=extraction_result.duration
    )
    
    # Step 3: Severity Assessment
    severity_result = await severity_classifier.assess(
        symptoms=extraction_result.symptoms,
        disease=disease_result.top_prediction,
        duration=extraction_result.duration,
        severity_words=extraction_result.severity_words
    )
    
    # Step 4: Check for Emergency
    if severity_result.emergency:
        return generate_emergency_response(
            extraction_result, 
            severity_result,
            extraction_result.language
        )
    
    # Step 5: Remedy Retrieval
    remedies = await remedy_retriever.search(
        symptoms=extraction_result.symptoms,
        disease=disease_result.top_prediction,
        severity=severity_result.severity,
        user_allergies=user_profile.get("allergies", []),
        user_conditions=user_profile.get("conditions", [])
    )
    
    # Step 6: Response Generation
    response = await response_generator.generate(
        symptoms=extraction_result.symptoms,
        disease=disease_result,
        severity=severity_result,
        remedies=remedies,
        language=extraction_result.language,
        conversation_history=conversation_history
    )
    
    # Step 7: Log for analysis
    await log_interaction(user_input, response, extraction_result, disease_result, severity_result)
    
    return response
________________________________________
9. Phase-wise Implementation Plan
Phase 1: MVP (Weeks 1-8)
Goals
•	Launch basic working version
•	Validate core concept
•	Gather user feedback
Implementation
Component	Approach	Effort
Symptom Extractor	Rule-based + keyword dictionary	2 weeks
Disease Classifier	XGBoost on public dataset	2 weeks
Severity Classifier	Rule-based with critical symptoms	1 week
Remedy Retriever	Keyword search (no RAG)	1 week
Response Generator	Templates	1 week
Integration & Testing	API + basic tests	1 week
Tech Stack (Phase 1)
Component	Technology
Language	Python 3.10+
ML	Scikit-learn, XGBoost
NLP	spaCy, regex
Database	SQLite
API	FastAPI
Deployment	Docker
Deliverables
•	Working API with all 5 components
•	70%+ accuracy on disease prediction
•	Support for 100+ symptoms, 50+ diseases
•	Hindi + English support (basic)
Budget: ₹15-25 Lakh
________________________________________
Phase 2: Enhanced (Weeks 9-20)
Goals
•	Improve accuracy significantly
•	Add RAG for remedies
•	Better multilingual support
Implementation
Component	Upgrade	Effort
Symptom Extractor	Add LLM fallback	2 weeks
Disease Classifier	Fine-tune with more data	3 weeks
Severity Classifier	Train ML model	2 weeks
Remedy Retriever	Full RAG with embeddings	3 weeks
Response Generator	Add LLM option	2 weeks
Tech Stack Additions
Component	Technology
Embeddings	sentence-transformers
Vector DB	ChromaDB → Pinecone
LLM	OpenAI API / Claude API
Multilingual	MuRIL, IndicNLP
Deliverables
•	80%+ accuracy on disease prediction
•	Natural conversation via LLM
•	Full RAG-based remedy retrieval
•	Hindi + English + Hinglish support
Budget: ₹20-35 Lakh (additional)
________________________________________
Phase 3: Advanced (Weeks 21-36)
Goals
•	Production-grade accuracy
•	Regional language support
•	Doctor integration
Implementation
Component	Upgrade	Effort
Symptom Extractor	Fine-tuned MuRIL NER	4 weeks
Disease Classifier	Ensemble models	4 weeks
Severity Classifier	Multi-factor with user history	3 weeks
Remedy Retriever	Advanced RAG + reranking	3 weeks
Response Generator	Fine-tuned LLM	4 weeks
New: Doctor Finder	Location-based recommendations	4 weeks
Tech Stack Additions
Component	Technology
NER	Fine-tuned MuRIL
Classification	Ensemble (XGBoost + NN)
LLM	Fine-tuned model
Languages	5+ Indian languages
Deliverables
•	90%+ accuracy on disease prediction
•	Support for 5+ Indian languages
•	Doctor recommendations with location
•	Emergency protocol integration
Budget: ₹30-50 Lakh (additional)
________________________________________
Timeline Summary
Month 1-2: Phase 1 Development
├── Week 1-2: Symptom Extractor
├── Week 3-4: Disease Classifier
├── Week 5: Severity Classifier
├── Week 6: Remedy Retriever
├── Week 7: Response Generator
└── Week 8: Integration & Testing

Month 3-5: Phase 2 Development
├── Week 9-10: LLM Integration
├── Week 11-13: Model Improvements
├── Week 14-16: RAG Implementation
├── Week 17-18: Multilingual Enhancement
└── Week 19-20: Testing & Optimization

Month 6-9: Phase 3 Development
├── Week 21-24: Advanced NER
├── Week 25-28: Ensemble Models
├── Week 29-32: Fine-tuned LLM
├── Week 33-36: Doctor Integration
└── Week 37-40: Final Testing & Launch
________________________________________
10. Technical Stack Summary
Complete Stack by Phase
Layer	Phase 1	Phase 2	Phase 3
Language	Python 3.10+	Python 3.10+	Python 3.10+
ML Framework	Scikit-learn	+ PyTorch	+ HuggingFace
NLP	spaCy + regex	+ Transformers	+ Fine-tuned MuRIL
Vector DB	-	ChromaDB	Pinecone
LLM	-	OpenAI/Claude API	Fine-tuned model
Database	SQLite	PostgreSQL	PostgreSQL + Redis
API	FastAPI	FastAPI	FastAPI + gRPC
Cache	-	Redis	Redis Cluster
Deployment	Docker	Docker + K8s	K8s + Auto-scaling
Key Libraries
# Core
python = "3.10+"
fastapi = "0.100+"
pydantic = "2.0+"
uvicorn = "0.22+"

# ML & NLP
scikit-learn = "1.3+"
xgboost = "2.0+"
spacy = "3.6+"
transformers = "4.30+"
torch = "2.0+"
sentence-transformers = "2.2+"

# Vector DB
chromadb = "0.4+"
pinecone-client = "2.2+"

# LLM
openai = "1.0+"
anthropic = "0.5+"
langchain = "0.1+"

# Database
sqlalchemy = "2.0+"
asyncpg = "0.28+"
redis = "4.6+"

# Utilities
pandas = "2.0+"
numpy = "1.24+"
pyyaml = "6.0+"
________________________________________
11. Cost Estimates (INR)
Development Costs by Phase
Phase	Duration	Cost Range (₹)
Phase 1 (MVP)	2 months	₹15,00,000 - 25,00,000
Phase 2 (Enhanced)	3 months	₹20,00,000 - 35,00,000
Phase 3 (Advanced)	4 months	₹30,00,000 - 50,00,000
Total	9 months	₹65,00,000 - 1,10,00,000
Monthly Operational Costs
Phase 1 (MVP)
Item	Monthly Cost (₹)
Cloud Hosting (API + DB)	₹8,000 - 15,000
Model Inference	₹5,000 - 10,000
Monitoring	₹1,000 - 2,000
Total	₹14,000 - 27,000
Phase 2 (With LLM APIs)
Item	Monthly Cost (₹)
Cloud Hosting	₹15,000 - 25,000
LLM API (1000 users/day)	₹25,000 - 50,000
Vector DB	₹5,000 - 10,000
Monitoring	₹2,000 - 5,000
Total	₹47,000 - 90,000
Phase 3 (Scale)
Item	Monthly Cost (₹)
Cloud Hosting (scaled)	₹40,000 - 80,000
LLM API (10K users/day)	₹1,50,000 - 3,00,000
Vector DB (Pinecone)	₹15,000 - 30,000
Monitoring & Logging	₹10,000 - 20,000
Total	₹2,15,000 - 4,30,000
Cost Optimization Tips
Strategy	Potential Savings
Use Gemini Flash instead of GPT-4	50-70% on LLM costs
Cache frequent responses	20-30% on API calls
Batch inference requests	15-25% on compute
Use spot instances	60-70% on cloud
Self-host smaller models	Long-term savings
________________________________________
12. Appendix: Code Examples
A. Symptom Extractor (Rule-Based)
import re
from typing import Dict, List, Any

class SymptomExtractor:
    def __init__(self):
        self.symptom_patterns = self._load_symptom_patterns()
        self.hindi_to_english = self._load_translations()
        
    def extract(self, text: str) -> Dict[str, Any]:
        # Normalize text
        text = text.lower().strip()
        
        # Detect language
        language = self._detect_language(text)
        
        # Transliterate if needed
        if language in ["hindi", "hinglish"]:
            text = self._transliterate(text)
        
        # Extract symptoms
        symptoms = self._extract_symptoms(text)
        
        # Extract duration
        duration = self._extract_duration(text)
        
        # Extract body parts
        body_parts = self._extract_body_parts(text)
        
        return {
            "symptoms": symptoms,
            "duration": duration,
            "body_parts": body_parts,
            "language": language,
            "confidence": self._calculate_confidence(symptoms)
        }
    
    def _extract_symptoms(self, text: str) -> List[str]:
        found_symptoms = []
        
        for symptom, patterns in self.symptom_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    found_symptoms.append(symptom)
                    break
        
        return list(set(found_symptoms))
    
    def _extract_duration(self, text: str) -> Dict[str, Any]:
        duration_patterns = [
            (r'(\d+)\s*din', 'days'),
            (r'(\d+)\s*day', 'days'),
            (r'(\d+)\s*week', 'weeks'),
            (r'(\d+)\s*hafte', 'weeks'),
            (r'(\d+)\s*ghante', 'hours'),
            (r'(\d+)\s*hour', 'hours'),
        ]
        
        for pattern, unit in duration_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return {"value": int(match.group(1)), "unit": unit}
        
        return {"value": None, "unit": None}
B. Disease Classifier (XGBoost)
import xgboost as xgb
import numpy as np
from typing import List, Dict

class DiseaseClassifier:
    def __init__(self, model_path: str):
        self.model = xgb.XGBClassifier()
        self.model.load_model(model_path)
        self.symptom_to_idx = self._load_symptom_index()
        self.idx_to_disease = self._load_disease_index()
        
    def predict(self, symptoms: List[str], top_k: int = 3) -> Dict:
        # Convert symptoms to feature vector
        features = self._symptoms_to_features(symptoms)
        
        # Get probabilities
        probabilities = self.model.predict_proba([features])[0]
        
        # Get top K predictions
        top_indices = np.argsort(probabilities)[-top_k:][::-1]
        
        predictions = []
        for idx in top_indices:
            disease = self.idx_to_disease[idx]
            confidence = float(probabilities[idx])
            if confidence > 0.1:  # Minimum threshold
                predictions.append({
                    "disease": disease,
                    "confidence": round(confidence, 2)
                })
        
        return {
            "predictions": predictions,
            "top_prediction": predictions[0]["disease"] if predictions else None
        }
    
    def _symptoms_to_features(self, symptoms: List[str]) -> np.ndarray:
        features = np.zeros(len(self.symptom_to_idx))
        for symptom in symptoms:
            if symptom in self.symptom_to_idx:
                features[self.symptom_to_idx[symptom]] = 1
        return features
C. Severity Classifier
from typing import Dict, List, Any

class SeverityClassifier:
    EMERGENCY_SYMPTOMS = {
        "chest pain", "difficulty breathing", "unconsciousness",
        "severe bleeding", "stroke symptoms", "seizure"
    }
    
    SERIOUS_SYMPTOMS = {
        "high fever", "blood in stool", "blood in urine",
        "severe abdominal pain", "persistent vomiting"
    }
    
    def assess(self, symptoms: List[str], duration: Dict, 
               disease_confidence: float) -> Dict[str, Any]:
        
        # Check emergency symptoms first
        emergency_found = set(symptoms) & self.EMERGENCY_SYMPTOMS
        if emergency_found:
            return {
                "severity": "Emergency",
                "confidence": 0.99,
                "emergency": True,
                "reason": f"Critical symptom detected: {list(emergency_found)[0]}",
                "action": "Call 108 immediately"
            }
        
        # Check serious symptoms
        serious_found = set(symptoms) & self.SERIOUS_SYMPTOMS
        if serious_found:
            return {
                "severity": "Serious",
                "confidence": 0.90,
                "emergency": False,
                "reason": f"Serious symptom detected: {list(serious_found)[0]}",
                "action": "Consult a doctor within 24 hours"
            }
        
        # Use ML model for remaining cases
        severity_score = self._calculate_severity_score(
            symptoms, duration, disease_confidence
        )
        
        if severity_score > 0.7:
            return {"severity": "Serious", "confidence": severity_score, "emergency": False}
        elif severity_score > 0.4:
            return {"severity": "Mild", "confidence": severity_score, "emergency": False}
        else:
            return {"severity": "Normal", "confidence": 1 - severity_score, "emergency": False}
    
    def _calculate_severity_score(self, symptoms, duration, disease_confidence):
        score = 0.0
        
        # Factor 1: Number of symptoms
        score += min(len(symptoms) * 0.1, 0.3)
        
        # Factor 2: Duration
        if duration.get("value"):
            if duration["unit"] == "days" and duration["value"] > 3:
                score += 0.2
            elif duration["unit"] == "weeks":
                score += 0.3
        
        # Factor 3: Disease confidence
        score += disease_confidence * 0.2
        
        return min(score, 1.0)
D. RAG Remedy Retriever
from sentence_transformers import SentenceTransformer
import chromadb
from typing import List, Dict

class RemedyRetriever:
    def __init__(self, db_path: str):
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_collection("remedies")
        
    def search(self, symptoms: List[str], disease: str,
               user_allergies: List[str] = None,
               top_k: int = 5) -> List[Dict]:
        
        # Create search query
        query = f"home remedies for {' '.join(symptoms)} {disease}"
        
        # Generate embedding
        query_embedding = self.embedder.encode(query).tolist()
        
        # Search vector database
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k * 2  # Get extra for filtering
        )
        
        # Process and filter results
        remedies = []
        for i, doc in enumerate(results['documents'][0]):
            metadata = results['metadatas'][0][i]
            
            # Check for allergies
            if user_allergies:
                allergens = metadata.get('allergens', [])
                if any(a in allergens for a in user_allergies):
                    continue
            
            remedies.append({
                "name": metadata['name'],
                "description": doc,
                "ingredients": metadata.get('ingredients', []),
                "source": metadata.get('source', 'Traditional'),
                "confidence": 1 - results['distances'][0][i]
            })
            
            if len(remedies) >= top_k:
                break
        
        return remedies
E. FastAPI Integration
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Mini Doctor API")

# Initialize components
symptom_extractor = SymptomExtractor()
disease_classifier = DiseaseClassifier("models/disease_model.json")
severity_classifier = SeverityClassifier()
remedy_retriever = RemedyRetriever("data/remedies_db")
response_generator = ResponseGenerator()

class HealthQuery(BaseModel):
    message: str
    user_id: Optional[str] = None
    language: Optional[str] = "auto"

class HealthResponse(BaseModel):
    response: str
    symptoms: List[str]
    disease_prediction: dict
    severity: dict
    remedies: List[dict]

@app.post("/analyze", response_model=HealthResponse)
async def analyze_symptoms(query: HealthQuery):
    try:
        # Step 1: Extract symptoms
        extraction = symptom_extractor.extract(query.message)
        
        if not extraction["symptoms"]:
            return HealthResponse(
                response="I couldn't identify any symptoms. Could you describe how you're feeling?",
                symptoms=[],
                disease_prediction={},
                severity={},
                remedies=[]
            )
        
        # Step 2: Predict disease
        disease_result = disease_classifier.predict(extraction["symptoms"])
        
        # Step 3: Assess severity
        severity_result = severity_classifier.assess(
            extraction["symptoms"],
            extraction["duration"],
            disease_result["predictions"][0]["confidence"] if disease_result["predictions"] else 0
        )
        
        # Step 4: Get remedies (skip if emergency)
        remedies = []
        if not severity_result.get("emergency"):
            remedies = remedy_retriever.search(
                extraction["symptoms"],
                disease_result.get("top_prediction", "")
            )
        
        # Step 5: Generate response
        response = response_generator.generate(
            extraction,
            disease_result,
            severity_result,
            remedies,
            extraction["language"]
        )
        
        return HealthResponse(
            response=response,
            symptoms=extraction["symptoms"],
            disease_prediction=disease_result,
            severity=severity_result,
            remedies=remedies
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
________________________________________
Document End
Prepared For: Mini Doctor Project
Version: 1.0
Last Updated: 2024
