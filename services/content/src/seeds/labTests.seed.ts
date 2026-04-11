import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';

// Load from root .env (two levels up from services/content)
config({ path: resolve(__dirname, '../../../../.env') });
import { LabTest } from '../models/labTest.model';
import { LabPackage } from '../models/labPackage.model';

const tests = [
  // ── Thyroid ──────────────────────────────────────────────────────────────
  {
    name: 'Thyroid Profile Test',
    subtitle: '(T3, T4, TSH) / TFT',
    slug: 'thyroid-profile-test',
    shortDescription: 'Measures T3, T4, and TSH to assess thyroid gland function.',
    description:
      'A thyroid profile test is a blood test that measures key thyroid hormones (T3, T4) and thyroid-stimulating hormone (TSH) to assess how well your thyroid gland is functioning. It helps identify imbalances that can cause symptoms like fatigue, weight changes, mood swings, or irregular heartbeat, and supports early detection of conditions such as hypothyroidism or hyperthyroidism.',
    tags: ['Thyroid'],
    sampleTypes: ['Blood'],
    whenToTest: ['Severe Hair Loss', 'Mood Swings', 'Unexplained Weight Loss or Gain', 'Dry Skin', 'Constipation'],
    includedTestNames: ['Thyroxine (T4) Test', 'Triiodothyronine (T3) Test', 'Thyroid Stimulating Hormone (TSH)'],
    preparations: [
      { text: 'Fasting usually not required (follow your lab\'s advice).' },
      { text: 'Tell your doctor about any medicines or supplements you take.' },
      { text: 'Avoid heavy exercise or stress before the test.' },
    ],
    sections: {
      ranges: 'TSH: 0.4–4.0 mIU/L | Free T4: 0.8–1.8 ng/dL | Free T3: 2.3–4.1 pg/mL',
      resultInterpretation:
        'High TSH with low T4 suggests hypothyroidism. Low TSH with high T4/T3 suggests hyperthyroidism. Results must be interpreted alongside symptoms.',
      riskAssessment: 'Uncontrolled thyroid disorders increase risk of heart disease, osteoporosis, and infertility.',
      whatDetects: 'Hypothyroidism, hyperthyroidism, Hashimoto\'s thyroiditis, Graves\' disease.',
      frequency: 'Annually if you have a thyroid condition or family history. Every 5 years for general screening.',
      indications: 'Unexplained fatigue, weight changes, hair loss, mood changes, goitre, or family history of thyroid disease.',
      parameters: 'TSH, Free T3, Free T4',
      risksLimitations: 'Certain medications (steroids, biotin) can affect results. Pregnancy alters normal ranges.',
    },
    price: 350,
  },
  {
    name: 'Thyroxine (T4) Test',
    slug: 'thyroxine-t4-test',
    shortDescription: 'Measures T4 hormone level produced by the thyroid gland.',
    description:
      'The thyroxine (T4) test measures the level of T4 hormone in the blood. T4 is one of the two major hormones produced by the thyroid gland and plays a key role in regulating metabolism, growth, and development.',
    tags: ['Thyroid'],
    sampleTypes: ['Blood'],
    whenToTest: ['Fatigue', 'Weight Gain', 'Cold Intolerance', 'Hair Loss'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Total T4: 5.0–12.0 mcg/dL | Free T4: 0.8–1.8 ng/dL',
      resultInterpretation: 'Low T4 may indicate hypothyroidism; high T4 may indicate hyperthyroidism.',
      frequency: 'As directed by a physician.',
      parameters: 'Free T4, Total T4',
    },
    price: 180,
  },
  {
    name: 'Triiodothyronine (T3) Test',
    slug: 'triiodothyronine-t3-test',
    shortDescription: 'Measures T3 hormone to help diagnose thyroid disorders.',
    description:
      'The T3 test measures the level of triiodothyronine, the active form of thyroid hormone. It is useful in diagnosing hyperthyroidism when T4 levels are normal but symptoms persist.',
    tags: ['Thyroid'],
    sampleTypes: ['Blood'],
    whenToTest: ['Palpitations', 'Tremors', 'Excessive Sweating', 'Anxiety'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Total T3: 80–200 ng/dL | Free T3: 2.3–4.1 pg/mL',
      resultInterpretation: 'Elevated T3 with low TSH suggests hyperthyroidism (T3 toxicosis).',
      frequency: 'As directed by a physician.',
      parameters: 'Free T3, Total T3',
    },
    price: 180,
  },
  {
    name: 'Thyroid Stimulating Hormone (TSH) Test',
    slug: 'tsh-test',
    shortDescription: 'Screens thyroid function by measuring TSH levels.',
    description:
      'TSH is produced by the pituitary gland and regulates thyroid hormone production. It is the most sensitive test for detecting thyroid dysfunction and is used for routine screening.',
    tags: ['Thyroid'],
    sampleTypes: ['Blood'],
    whenToTest: ['Fatigue', 'Unexplained Weight Change', 'Constipation', 'Dry Skin'],
    includedTestNames: [],
    preparations: [{ text: 'No fasting required.' }],
    sections: {
      ranges: 'Normal TSH: 0.4–4.0 mIU/L',
      resultInterpretation: 'High TSH indicates hypothyroidism; low TSH indicates hyperthyroidism.',
      frequency: 'Annually for those on thyroid medication.',
      parameters: 'TSH',
    },
    price: 150,
  },
  {
    name: 'Parathyroid Hormone (PTH) Test',
    slug: 'parathyroid-hormone-pth-test',
    shortDescription: 'Measures PTH to evaluate calcium and bone metabolism.',
    description:
      'PTH is produced by the parathyroid glands and regulates calcium and phosphorus levels in the blood. This test helps diagnose disorders of calcium metabolism, including hyperparathyroidism.',
    tags: ['Thyroid', 'Bone'],
    sampleTypes: ['Blood'],
    whenToTest: ['Bone Pain', 'Kidney Stones', 'Muscle Weakness', 'Frequent Urination'],
    includedTestNames: [],
    preparations: [{ text: 'Fasting for 8–12 hours may be required.' }],
    sections: {
      ranges: 'Normal PTH: 10–65 pg/mL',
      resultInterpretation: 'Elevated PTH with high calcium suggests hyperparathyroidism.',
      frequency: 'As directed by a physician.',
      parameters: 'Intact PTH',
    },
    price: 650,
  },
  {
    name: 'Anti Thyroglobulin Antibody Test',
    slug: 'anti-thyroglobulin-antibody-test',
    shortDescription: 'Detects antibodies against thyroglobulin indicating autoimmune thyroid disease.',
    description:
      'This test detects anti-thyroglobulin antibodies (Anti-TG), which are produced when the immune system attacks the thyroid. It is used to diagnose autoimmune thyroid conditions like Hashimoto\'s thyroiditis.',
    tags: ['Thyroid'],
    sampleTypes: ['Blood'],
    whenToTest: ['Goitre', 'Fatigue', 'Weight Gain', 'Family History of Autoimmune Disease'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Normal: < 115 IU/mL',
      resultInterpretation: 'Elevated levels suggest autoimmune thyroid disease.',
      frequency: 'As directed when autoimmune thyroid disease is suspected.',
      parameters: 'Anti-Thyroglobulin Antibody (Anti-TG)',
    },
    price: 450,
  },

  // ── Heart / Cardiac ───────────────────────────────────────────────────────
  {
    name: 'Lipid Profile',
    slug: 'lipid-profile',
    shortDescription: 'Measures cholesterol and triglycerides to assess cardiovascular risk.',
    description:
      'A lipid profile measures levels of total cholesterol, LDL, HDL, and triglycerides in the blood. It is one of the most important tests to assess your risk of heart disease, stroke, and atherosclerosis.',
    tags: ['Heart'],
    sampleTypes: ['Blood'],
    whenToTest: ['Chest Pain', 'Shortness of Breath', 'Obesity', 'Family History of Heart Disease'],
    includedTestNames: ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides', 'VLDL'],
    preparations: [
      { text: 'Fast for 9–12 hours before the test.' },
      { text: 'Avoid alcohol for 24 hours before the test.' },
    ],
    sections: {
      ranges: 'Total Cholesterol: < 200 mg/dL | LDL: < 100 mg/dL | HDL: > 60 mg/dL | Triglycerides: < 150 mg/dL',
      resultInterpretation: 'High LDL and low HDL significantly increase cardiovascular risk.',
      riskAssessment: 'High cholesterol is a major risk factor for heart attack and stroke.',
      whatDetects: 'Hyperlipidaemia, dyslipidaemia, cardiovascular disease risk.',
      frequency: 'Every 4–6 years for adults; annually if you have risk factors.',
      indications: 'Obesity, diabetes, hypertension, smoking, family history of heart disease.',
      parameters: 'Total Cholesterol, LDL, HDL, VLDL, Triglycerides, Cholesterol/HDL Ratio',
      risksLimitations: 'Results vary with diet, time of day, and physical activity.',
    },
    price: 400,
  },
  {
    name: 'Cardiac Risk Markers',
    slug: 'cardiac-risk-markers',
    shortDescription: 'Comprehensive panel to assess risk of heart attack and cardiac events.',
    description:
      'This panel includes multiple markers including lipids, homocysteine, CRP, and Lp(a) to provide a comprehensive assessment of your cardiovascular risk beyond a standard lipid profile.',
    tags: ['Heart'],
    sampleTypes: ['Blood'],
    whenToTest: ['Chest Pain', 'Family History of Heart Attack', 'Hypertension', 'Diabetes'],
    includedTestNames: ['Lipid Profile', 'hs-CRP', 'Homocysteine', 'Lipoprotein (a)'],
    preparations: [{ text: 'Fast for 10–12 hours before the test.' }],
    sections: {
      whatDetects: 'Elevated cardiovascular risk, inflammation, clotting tendency.',
      frequency: 'Annually for high-risk individuals.',
      parameters: 'hs-CRP, Homocysteine, Lp(a), Lipid Profile',
    },
    price: 1200,
  },
  {
    name: 'Troponin I Test',
    slug: 'troponin-i-test',
    shortDescription: 'Detects heart muscle damage; key marker for heart attack diagnosis.',
    description:
      'Troponin I is a protein released into the bloodstream when heart muscle cells are damaged. It is the gold standard marker for diagnosing a heart attack (myocardial infarction).',
    tags: ['Heart'],
    sampleTypes: ['Blood'],
    whenToTest: ['Chest Pain', 'Shortness of Breath', 'Arm or Jaw Pain', 'Suspected Heart Attack'],
    includedTestNames: [],
    preparations: [{ text: 'No preparation required; usually an emergency test.' }],
    sections: {
      ranges: 'Normal: < 0.04 ng/mL (varies by lab)',
      resultInterpretation: 'Any detectable rise above normal strongly suggests myocardial injury.',
      whatDetects: 'Myocardial infarction, myocarditis, unstable angina.',
      parameters: 'Troponin I',
    },
    price: 900,
  },
  {
    name: 'CRP (C-Reactive Protein) Test',
    slug: 'crp-test',
    shortDescription: 'Measures inflammation in the body; elevated in infections and heart disease.',
    description:
      'CRP is produced by the liver in response to inflammation. High-sensitivity CRP (hs-CRP) is used to assess cardiovascular risk, while standard CRP monitors infections and inflammatory conditions.',
    tags: ['Heart', 'Infection'],
    sampleTypes: ['Blood'],
    whenToTest: ['Fever', 'Joint Pain', 'Chest Pain', 'Fatigue'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Normal CRP: < 10 mg/L | hs-CRP Low Risk: < 1 mg/L | High Risk: > 3 mg/L',
      resultInterpretation: 'Persistently elevated hs-CRP indicates increased cardiovascular risk.',
      frequency: 'As part of cardiac risk assessment.',
      parameters: 'CRP / hs-CRP',
    },
    price: 350,
  },
  {
    name: 'Homocysteine Test',
    slug: 'homocysteine-test',
    shortDescription: 'Elevated homocysteine is a risk factor for heart disease and stroke.',
    description:
      'Homocysteine is an amino acid in the blood. Elevated levels can damage blood vessel walls and increase risk of heart disease, stroke, and blood clots.',
    tags: ['Heart'],
    sampleTypes: ['Blood'],
    whenToTest: ['Family History of Heart Disease', 'B12 Deficiency', 'Kidney Disease'],
    includedTestNames: [],
    preparations: [{ text: 'Fast for 8–12 hours before the test.' }],
    sections: {
      ranges: 'Normal: 5–15 µmol/L',
      resultInterpretation: 'Levels > 15 µmol/L indicate increased cardiovascular and stroke risk.',
      parameters: 'Homocysteine',
    },
    price: 700,
  },

  // ── Diabetes ──────────────────────────────────────────────────────────────
  {
    name: 'HbA1c Test',
    slug: 'hba1c-test',
    shortDescription: 'Measures average blood sugar over 3 months; key test for diabetes monitoring.',
    description:
      'HbA1c reflects average blood glucose levels over the past 2–3 months. It is used for diagnosing diabetes, prediabetes, and for monitoring how well diabetes is being managed.',
    tags: ['Diabetes'],
    sampleTypes: ['Blood'],
    whenToTest: ['Increased Thirst', 'Frequent Urination', 'Blurred Vision', 'Fatigue', 'Known Diabetes'],
    includedTestNames: [],
    preparations: [{ text: 'No fasting required.' }],
    sections: {
      ranges: 'Normal: < 5.7% | Prediabetes: 5.7–6.4% | Diabetes: ≥ 6.5%',
      resultInterpretation: 'HbA1c ≥ 6.5% on two separate tests confirms diabetes.',
      riskAssessment: 'Poorly controlled diabetes increases risk of kidney, eye, and nerve damage.',
      whatDetects: 'Type 1 & Type 2 diabetes, prediabetes.',
      frequency: 'Every 3 months if on diabetes treatment; every 6–12 months for screening.',
      parameters: 'HbA1c (Glycated Haemoglobin)',
    },
    price: 350,
  },
  {
    name: 'Blood Glucose Fasting',
    slug: 'blood-glucose-fasting',
    shortDescription: 'Measures blood sugar after an overnight fast.',
    description:
      'Fasting blood glucose is measured after at least 8 hours of fasting. It is used to screen for and diagnose diabetes and prediabetes.',
    tags: ['Diabetes'],
    sampleTypes: ['Blood'],
    whenToTest: ['Increased Thirst', 'Frequent Urination', 'Unexplained Weight Loss'],
    includedTestNames: [],
    preparations: [{ text: 'Fast for 8–12 hours before the test. Water is allowed.' }],
    sections: {
      ranges: 'Normal: 70–99 mg/dL | Prediabetes: 100–125 mg/dL | Diabetes: ≥ 126 mg/dL',
      resultInterpretation: 'Fasting glucose ≥ 126 mg/dL on two occasions confirms diabetes.',
      frequency: 'Annually for adults over 45; earlier if risk factors exist.',
      parameters: 'Fasting Blood Glucose',
    },
    price: 80,
  },
  {
    name: 'Blood Glucose PP (Post Prandial)',
    slug: 'blood-glucose-pp',
    shortDescription: 'Measures blood sugar 2 hours after a meal.',
    description:
      'Post prandial blood glucose is measured 2 hours after eating. It shows how efficiently your body processes sugar from food and is used alongside fasting glucose and HbA1c.',
    tags: ['Diabetes'],
    sampleTypes: ['Blood'],
    whenToTest: ['Known Diabetes', 'Prediabetes Monitoring', 'Gestational Diabetes'],
    includedTestNames: [],
    preparations: [{ text: 'Eat a standard meal and get tested exactly 2 hours after.' }],
    sections: {
      ranges: 'Normal: < 140 mg/dL | Prediabetes: 140–199 mg/dL | Diabetes: ≥ 200 mg/dL',
      resultInterpretation: 'PP glucose ≥ 200 mg/dL suggests diabetes.',
      frequency: 'As advised during diabetes management.',
      parameters: 'Post Prandial Blood Glucose',
    },
    price: 80,
  },
  {
    name: 'Insulin Fasting Test',
    slug: 'insulin-fasting-test',
    shortDescription: 'Measures insulin levels to assess insulin resistance.',
    description:
      'This test measures the amount of insulin in the blood after fasting. It helps diagnose insulin resistance, prediabetes, polycystic ovary syndrome (PCOS), and type 2 diabetes risk.',
    tags: ['Diabetes'],
    sampleTypes: ['Blood'],
    whenToTest: ['Obesity', 'PCOS', 'Prediabetes', 'Family History of Diabetes'],
    includedTestNames: [],
    preparations: [{ text: 'Fast for 8–12 hours before the test.' }],
    sections: {
      ranges: 'Normal fasting insulin: 2–25 µIU/mL',
      resultInterpretation: 'High fasting insulin with normal glucose suggests insulin resistance.',
      parameters: 'Fasting Insulin',
    },
    price: 500,
  },

  // ── Liver ─────────────────────────────────────────────────────────────────
  {
    name: 'Liver Function Test (LFT)',
    slug: 'liver-function-test',
    shortDescription: 'Assesses liver health by measuring liver enzymes and proteins.',
    description:
      'A liver function test (LFT) is a group of blood tests that check how well your liver is working. It measures enzymes and proteins produced by the liver to detect liver disease, damage, or inflammation.',
    tags: ['Liver'],
    sampleTypes: ['Blood'],
    whenToTest: ['Jaundice', 'Abdominal Pain', 'Nausea', 'Fatigue', 'Alcohol Use'],
    includedTestNames: ['SGOT/AST', 'SGPT/ALT', 'ALP', 'GGT', 'Bilirubin Total', 'Albumin', 'Total Protein'],
    preparations: [
      { text: 'Fast for 8–10 hours before the test.' },
      { text: 'Avoid alcohol for 24 hours before the test.' },
    ],
    sections: {
      ranges: 'ALT: 7–56 U/L | AST: 10–40 U/L | ALP: 44–147 U/L | Bilirubin Total: 0.1–1.2 mg/dL',
      resultInterpretation: 'Elevated ALT/AST indicates liver cell damage. High bilirubin causes jaundice.',
      whatDetects: 'Hepatitis, fatty liver disease, cirrhosis, liver failure.',
      frequency: 'Annually if you drink alcohol regularly or take hepatotoxic medications.',
      parameters: 'SGOT, SGPT, ALP, GGT, Total/Direct/Indirect Bilirubin, Albumin, Total Protein',
    },
    price: 550,
  },
  {
    name: 'Hepatitis B Surface Antigen (HBsAg)',
    slug: 'hepatitis-b-surface-antigen',
    shortDescription: 'Detects active Hepatitis B virus infection.',
    description:
      'HBsAg is the surface antigen of the Hepatitis B virus. A positive result indicates that the person is currently infected with Hepatitis B and can potentially spread the virus.',
    tags: ['Liver', 'Infection'],
    sampleTypes: ['Blood'],
    whenToTest: ['Jaundice', 'Fatigue', 'Dark Urine', 'Nausea', 'Pre-pregnancy Screening'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Non-reactive (Negative): Not infected | Reactive (Positive): Active infection',
      whatDetects: 'Acute or chronic Hepatitis B infection.',
      frequency: 'Annually for high-risk individuals; as part of pre-marital or antenatal screening.',
      parameters: 'HBsAg',
    },
    price: 250,
  },
  {
    name: 'Hepatitis C Antibody Test',
    slug: 'hepatitis-c-antibody-test',
    shortDescription: 'Screens for Hepatitis C virus infection.',
    description:
      'This test detects antibodies against the Hepatitis C virus (HCV). A positive result indicates past or present HCV infection and requires confirmatory testing.',
    tags: ['Liver', 'Infection'],
    sampleTypes: ['Blood'],
    whenToTest: ['IV Drug Use', 'Received Blood Transfusion Before 1992', 'Unexplained Liver Disease'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Non-reactive: Not infected | Reactive: Possible infection (confirmatory test needed)',
      whatDetects: 'Hepatitis C virus infection.',
      frequency: 'Once for all adults 18–79 per CDC guidelines; more often for high-risk groups.',
      parameters: 'Anti-HCV Antibody',
    },
    price: 700,
  },

  // ── Kidney ────────────────────────────────────────────────────────────────
  {
    name: 'Kidney Function Test (KFT)',
    slug: 'kidney-function-test',
    shortDescription: 'Evaluates kidney health by measuring waste products in blood.',
    description:
      'A kidney function test (KFT) measures creatinine, urea, and other waste products in the blood to assess how well the kidneys are filtering waste. It is essential for diagnosing chronic kidney disease.',
    tags: ['Kidney'],
    sampleTypes: ['Blood'],
    whenToTest: ['Swelling in Legs', 'Frequent Urination', 'Foamy Urine', 'Hypertension', 'Diabetes'],
    includedTestNames: ['Serum Creatinine', 'Blood Urea Nitrogen', 'eGFR', 'Uric Acid', 'Electrolytes'],
    preparations: [
      { text: 'Avoid high-protein meals the night before.' },
      { text: 'Stay well hydrated.' },
    ],
    sections: {
      ranges: 'Creatinine (male): 0.7–1.3 mg/dL | eGFR Normal: > 60 mL/min/1.73m²',
      resultInterpretation: 'eGFR < 60 for 3+ months indicates chronic kidney disease.',
      whatDetects: 'Chronic kidney disease, acute kidney injury, kidney stones.',
      frequency: 'Annually if you have diabetes or hypertension.',
      parameters: 'Serum Creatinine, BUN, eGFR, Uric Acid, Na, K, Cl, Bicarbonate',
    },
    price: 500,
  },
  {
    name: 'Urine Routine Examination',
    slug: 'urine-routine-examination',
    shortDescription: 'Screens urine for infection, kidney disease, and metabolic disorders.',
    description:
      'A routine urine examination (urinalysis) analyses the physical, chemical, and microscopic properties of urine. It helps detect urinary tract infections, kidney disease, and diabetes.',
    tags: ['Kidney'],
    sampleTypes: ['Urine'],
    whenToTest: ['Burning Urination', 'Frequent Urination', 'Blood in Urine', 'Back Pain'],
    includedTestNames: [],
    preparations: [
      { text: 'Collect midstream urine in a clean container.' },
      { text: 'First morning sample preferred.' },
    ],
    sections: {
      whatDetects: 'UTI, kidney stones, diabetes, kidney disease, dehydration.',
      frequency: 'Annually as part of a routine health check.',
      parameters: 'Colour, Clarity, pH, Specific Gravity, Protein, Glucose, Ketones, RBC, WBC, Casts',
    },
    price: 100,
  },
  {
    name: 'Microalbumin Test',
    slug: 'microalbumin-test',
    shortDescription: 'Detects early kidney damage in diabetics and hypertensives.',
    description:
      'Microalbuminuria is the presence of small amounts of albumin in the urine. It is the earliest sign of kidney damage in people with diabetes or high blood pressure, before overt proteinuria develops.',
    tags: ['Kidney', 'Diabetes'],
    sampleTypes: ['Urine'],
    whenToTest: ['Diabetes', 'High Blood Pressure', 'Family History of Kidney Disease'],
    includedTestNames: [],
    preparations: [{ text: 'Collect first morning urine sample.' }],
    sections: {
      ranges: 'Normal: < 30 mg/g creatinine | Microalbuminuria: 30–300 mg/g | Macroalbuminuria: > 300 mg/g',
      resultInterpretation: 'Persistent microalbuminuria requires immediate medical attention.',
      frequency: 'Annually for all diabetics and hypertensives.',
      parameters: 'Urine Microalbumin, Urine Creatinine, Albumin:Creatinine Ratio',
    },
    price: 400,
  },

  // ── Blood / General ───────────────────────────────────────────────────────
  {
    name: 'Complete Blood Count (CBC)',
    slug: 'complete-blood-count',
    shortDescription: 'Measures all blood cell types; essential health screening test.',
    description:
      'A complete blood count (CBC) is one of the most common blood tests. It measures red blood cells, white blood cells, haemoglobin, haematocrit, and platelets to detect anaemia, infection, and many other disorders.',
    tags: ['Blood'],
    sampleTypes: ['Blood'],
    whenToTest: ['Fatigue', 'Weakness', 'Frequent Infections', 'Bruising Easily', 'Pale Skin'],
    includedTestNames: ['Haemoglobin', 'RBC Count', 'WBC Count', 'Platelet Count', 'Haematocrit', 'MCV', 'MCH', 'MCHC'],
    preparations: [{ text: 'No special preparation required (fasting optional).' }],
    sections: {
      ranges: 'Haemoglobin (male): 13.5–17.5 g/dL | (female): 12.0–15.5 g/dL | WBC: 4,500–11,000/µL | Platelets: 150,000–400,000/µL',
      resultInterpretation: 'Low Hb = anaemia; high WBC = infection/inflammation; low platelets = bleeding risk.',
      whatDetects: 'Anaemia, infections, leukaemia, clotting disorders.',
      frequency: 'Annually as part of routine check-up.',
      parameters: 'RBC, WBC, Hb, Haematocrit, MCV, MCH, MCHC, RDW, Platelets, Differential WBC Count',
    },
    price: 200,
  },
  {
    name: 'ESR (Erythrocyte Sedimentation Rate)',
    slug: 'esr-test',
    shortDescription: 'Non-specific marker of inflammation in the body.',
    description:
      'ESR measures how quickly red blood cells settle at the bottom of a test tube. A high ESR indicates inflammation and is used alongside other tests to monitor conditions like rheumatoid arthritis, lupus, and infections.',
    tags: ['Blood', 'Infection'],
    sampleTypes: ['Blood'],
    whenToTest: ['Joint Pain', 'Fever', 'Fatigue', 'Headache', 'Loss of Appetite'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Normal (male < 50): 0–15 mm/hr | (female < 50): 0–20 mm/hr',
      resultInterpretation: 'Elevated ESR indicates ongoing inflammation but does not identify its cause.',
      parameters: 'ESR (Westergren Method)',
    },
    price: 100,
  },
  {
    name: 'Iron Studies',
    slug: 'iron-studies',
    shortDescription: 'Evaluates iron stores and transport to diagnose iron deficiency or overload.',
    description:
      'Iron studies measure serum iron, ferritin, TIBC, and transferrin saturation to diagnose iron deficiency anaemia, iron overload (haemochromatosis), and chronic disease anaemia.',
    tags: ['Blood'],
    sampleTypes: ['Blood'],
    whenToTest: ['Fatigue', 'Pale Skin', 'Brittle Nails', 'Shortness of Breath', 'Hair Loss'],
    includedTestNames: ['Serum Iron', 'Serum Ferritin', 'TIBC', 'Transferrin Saturation'],
    preparations: [{ text: 'Fast for 8 hours before the test.' }],
    sections: {
      ranges: 'Serum Ferritin (male): 30–400 ng/mL | Serum Iron: 60–170 µg/dL | TIBC: 240–450 µg/dL',
      resultInterpretation: 'Low ferritin + low iron + high TIBC confirms iron deficiency anaemia.',
      whatDetects: 'Iron deficiency anaemia, haemochromatosis, anaemia of chronic disease.',
      frequency: 'As directed for monitoring iron supplementation or chronic anaemia.',
      parameters: 'Serum Iron, Serum Ferritin, TIBC, Transferrin Saturation',
    },
    price: 600,
  },
  {
    name: 'Vitamin D Test',
    slug: 'vitamin-d-test',
    shortDescription: 'Measures Vitamin D levels to detect deficiency or toxicity.',
    description:
      'This test measures 25-hydroxyvitamin D, the main form of vitamin D in the blood. Vitamin D deficiency is extremely common in India and is linked to bone loss, immune dysfunction, and increased risk of chronic disease.',
    tags: ['Blood', 'Bone'],
    sampleTypes: ['Blood'],
    whenToTest: ['Bone Pain', 'Muscle Weakness', 'Fatigue', 'Depression', 'Limited Sun Exposure'],
    includedTestNames: [],
    preparations: [{ text: 'No special preparation required.' }],
    sections: {
      ranges: 'Deficient: < 20 ng/mL | Insufficient: 20–29 ng/mL | Sufficient: 30–100 ng/mL',
      resultInterpretation: 'Levels < 20 ng/mL require supplementation. Levels > 100 ng/mL may indicate toxicity.',
      frequency: 'Annually, especially for those with limited sun exposure.',
      parameters: '25-Hydroxy Vitamin D (25-OH Vitamin D)',
    },
    price: 1200,
  },
];

const packages = [
  {
    name: 'Thyroid Care',
    slug: 'thyroid-care',
    tags: ['Thyroid'],
    testCount: 31,
    price: 1499,
  },
  {
    name: 'Thyroid Profile Test',
    slug: 'thyroid-profile-package',
    tags: ['Thyroid'],
    testCount: 3,
    price: 499,
  },
  {
    name: 'Thyroid & Lipid Panel',
    slug: 'thyroid-lipid-panel',
    tags: ['Thyroid', 'Heart'],
    testCount: 14,
    price: 999,
  },
  {
    name: 'Comprehensive Health Check',
    slug: 'comprehensive-health-check',
    tags: ['Blood', 'Liver', 'Kidney', 'Diabetes', 'Thyroid', 'Heart'],
    testCount: 72,
    price: 2499,
  },
  {
    name: 'Diabetes Care Package',
    slug: 'diabetes-care-package',
    tags: ['Diabetes', 'Kidney'],
    testCount: 18,
    price: 1299,
  },
];

async function seed() {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  await mongoose.connect(url);
  console.log('Connected to MongoDB');

  await LabTest.deleteMany({});
  await LabPackage.deleteMany({});
  console.log('Cleared existing lab test data');

  await LabTest.insertMany(tests);
  console.log(`Seeded ${tests.length} lab tests`);

  await LabPackage.insertMany(packages);
  console.log(`Seeded ${packages.length} lab packages`);

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
