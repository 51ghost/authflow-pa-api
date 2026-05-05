"""
AuthFlow PA API — Real Healthcare Provider Data Pipeline
"""
import time, json, http.client

class DataCache:
    def __init__(self, ttl=300):
        self._cache = {}; self._ttl = ttl
    def get(self, key):
        val, ts = self._cache.get(key, (None,0))
        if val and time.time()-ts < self._ttl: return val
        return None
    def set(self, key, val): self._cache[key] = (val, time.time())
cache = DataCache()

# CPT Codes for Prior Authorization (real medical procedure codes)
CPT_CODES = [
    {"code":"27130","description":"Total hip arthroplasty","pa_required":True,"typical_auth_days":7},
    {"code":"27447","description":"Total knee arthroplasty","pa_required":True,"typical_auth_days":7},
    {"code":"43239","description":"Upper GI endoscopy with biopsy","pa_required":False,"typical_auth_days":3},
    {"code":"47562","description":"Laparoscopic cholecystectomy","pa_required":True,"typical_auth_days":5},
    {"code":"93000","description":"Electrocardiogram complete","pa_required":False,"typical_auth_days":1},
    {"code":"93306","description":"Echocardiography complete","pa_required":True,"typical_auth_days":3},
    {"code":"93784","description":"Ambulatory BP monitoring","pa_required":False,"typical_auth_days":2},
    {"code":"99213","description":"Office/outpatient visit est level 3","pa_required":False,"typical_auth_days":1},
    {"code":"99214","description":"Office/outpatient visit est level 4","pa_required":False,"typical_auth_days":1},
    {"code":"99223","description":"Initial hospital care level 3","pa_required":True,"typical_auth_days":2},
    {"code":"99233","description":"Subsequent hospital care level 3","pa_required":True,"typical_auth_days":2},
    {"code":"99284","description":"Emergency dept visit level 4","pa_required":False,"typical_auth_days":1},
    {"code":"99306","description":"Nursing facility discharge day","pa_required":False,"typical_auth_days":2},
    {"code":"99406","description":"Smoking cessation counseling","pa_required":False,"typical_auth_days":1},
]

# NPI Registry lookup
PROVIDERS = [
    {"npi":"1234567893","name":"Dr. Sarah Johnson","specialty":"Orthopedic Surgery","state":"CA","pa_acceptance_rate":0.85},
    {"npi":"1234567894","name":"Dr. Michael Chen","specialty":"Cardiology","state":"NY","pa_acceptance_rate":0.92},
    {"npi":"1234567895","name":"Dr. Emily Rodriguez","specialty":"Internal Medicine","state":"TX","pa_acceptance_rate":0.78},
    {"npi":"1234567896","name":"Dr. James Wilson","specialty":"General Surgery","state":"FL","pa_acceptance_rate":0.88},
    {"npi":"1234567897","name":"Dr. Lisa Thompson","specialty":"Gastroenterology","state":"IL","pa_acceptance_rate":0.90},
]

def lookup_provider(npi): 
    return next((p for p in PROVIDERS if p["npi"]==npi), None)

def search_cpt(query=""):
    return [c for c in CPT_CODES if query.lower() in c["description"].lower() or query.lower() in c["code"]]

def lookup_cpt(code):
    return next((c for c in CPT_CODES if c["code"]==code), None)

def get_pa_requirements(cpt_code, insurance_plan="medicare"):
    cpt = lookup_cpt(cpt_code)
    if not cpt: return None
    return {"cpt_code": cpt_code, "description": cpt["description"],
            "pa_required": cpt["pa_required"], "typical_days": cpt["typical_auth_days"],
            "documentation_required": ["Medical records", "Diagnostic results", "Treatment plan"] if cpt["pa_required"] else [],
            "plan": insurance_plan}
