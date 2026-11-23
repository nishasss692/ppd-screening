"""FastAPI Router for public Doctor and Hospital directories.

Exposes:
- GET /api/hospitals: List all partner hospitals and clinics
- GET /api/doctors: Search and list maternal mental health specialists
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Query

from backend.schemas.directory import DoctorDirectoryItem, HospitalDirectoryItem

router = APIRouter(prefix="/api", tags=["Directories"])

HOSPITALS_DIRECTORY: Dict[str, dict] = {
    "HOSP-001": {
        "hospitalId": "HOSP-001",
        "name": "Apollo Women's Hospital",
        "location": "Bangalore, Karnataka",
        "address": "154, Bannerghatta Road, Bangalore — 560 029",
        "phone": "+91 80-2222-3333",
    },
    "HOSP-002": {
        "hospitalId": "HOSP-002",
        "name": "Cloudnine Hospitals",
        "location": "Hyderabad, Telangana",
        "address": "Plot No. 11, Kondapur, Hyderabad — 500 084",
        "phone": "+91 40-6677-8899",
    },
    "HOSP-003": {
        "hospitalId": "HOSP-003",
        "name": "Rainbow Children's Hospital",
        "location": "Chennai, Tamil Nadu",
        "address": "22, Vijayaraghava Road, T. Nagar, Chennai — 600 017",
        "phone": "+91 44-7101-0101",
    },
    "HOSP-004": {
        "hospitalId": "HOSP-004",
        "name": "Motherhood Hospitals",
        "location": "Mumbai, Maharashtra",
        "address": "B-5, Linking Road, Santacruz West, Mumbai — 400 054",
        "phone": "+91 22-6922-0022",
    },
}

DOCTORS_DIRECTORY: List[dict] = [
    {
        "doctorId": "DR-001",
        "hospitalId": "HOSP-001",
        "name": "Dr. Priya Mehta",
        "initials": "PM",
        "specialization": "Perinatal Psychiatry",
        "subspecialties": ["Postpartum Depression", "Perinatal Anxiety", "Maternal Mental Health"],
        "yearsExperience": 14,
        "availability": "Mon, Wed, Fri · 10:00 AM – 2:00 PM",
        "consultationTypes": ["In-person", "Telehealth"],
        "timeSlots": ["10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM"],
        "demoFlag": True,
    },
    {
        "doctorId": "DR-002",
        "hospitalId": "HOSP-002",
        "name": "Dr. Ananya Krishnaswamy",
        "initials": "AK",
        "specialization": "Obstetrics & Maternal Mental Health",
        "subspecialties": ["Postpartum Mood Disorders", "Breastfeeding Support", "Sleep Health"],
        "yearsExperience": 11,
        "availability": "Tue, Thu · 09:00 AM – 1:00 PM",
        "consultationTypes": ["In-person", "Telehealth"],
        "timeSlots": ["09:00 AM", "10:30 AM", "12:00 PM"],
        "demoFlag": True,
    },
    {
        "doctorId": "DR-003",
        "hospitalId": "HOSP-001",
        "name": "Dr. Suresh Patel",
        "initials": "SP",
        "specialization": "Psychiatry & Psychotherapy",
        "subspecialties": ["Postpartum Depression", "Cognitive Behavioural Therapy", "Family Therapy"],
        "yearsExperience": 18,
        "availability": "Mon – Fri · 02:00 PM – 6:00 PM",
        "consultationTypes": ["In-person", "Telehealth", "Audio Consult"],
        "timeSlots": ["02:00 PM", "03:00 PM", "04:30 PM", "05:30 PM"],
        "demoFlag": True,
    },
    {
        "doctorId": "DR-004",
        "hospitalId": "HOSP-003",
        "name": "Dr. Divya Narayan",
        "initials": "DN",
        "specialization": "Clinical Psychology",
        "subspecialties": ["Perinatal Psychology", "Mindfulness Therapy", "Infant Bonding"],
        "yearsExperience": 9,
        "availability": "Wed, Fri, Sat · 10:00 AM – 3:00 PM",
        "consultationTypes": ["Telehealth", "In-person"],
        "timeSlots": ["10:00 AM", "11:30 AM", "01:00 PM", "02:30 PM"],
        "demoFlag": True,
    },
    {
        "doctorId": "DR-005",
        "hospitalId": "HOSP-002",
        "name": "Dr. Reema Chaudhary",
        "initials": "RC",
        "specialization": "General Psychiatry & Women's Health",
        "subspecialties": ["Postpartum Care", "Anxiety Disorders", "Partner Support"],
        "yearsExperience": 7,
        "availability": "Mon, Tue, Thu · 09:30 AM – 1:30 PM",
        "consultationTypes": ["Telehealth", "Audio Consult"],
        "timeSlots": ["09:30 AM", "11:00 AM", "12:30 PM"],
        "demoFlag": True,
    },
    {
        "doctorId": "DR-006",
        "hospitalId": "HOSP-004",
        "name": "Dr. Kavitha Sundaram",
        "initials": "KS",
        "specialization": "Perinatal Psychiatry & Lactation",
        "subspecialties": ["PPD Screening", "Breastfeeding & Mood", "Maternal Trauma"],
        "yearsExperience": 16,
        "availability": "Mon, Wed, Sat · 09:00 AM – 12:00 PM",
        "consultationTypes": ["In-person", "Telehealth"],
        "timeSlots": ["09:00 AM", "10:00 AM", "11:00 AM"],
        "demoFlag": True,
    },
]


@router.get(
    "/hospitals",
    response_model=List[HospitalDirectoryItem],
    summary="List partner hospitals and clinical facilities",
    description="Returns public profiles of affiliated maternal healthcare centers and clinics.",
)
async def get_hospital_directory() -> List[HospitalDirectoryItem]:
    """Retrieve full list of partner hospitals."""
    return [HospitalDirectoryItem(**h) for h in HOSPITALS_DIRECTORY.values()]


@router.get(
    "/doctors",
    response_model=List[DoctorDirectoryItem],
    summary="Search maternal mental health doctors and clinicians",
    description="Returns doctors filtered by optional location (city) or specialization query parameters.",
)
async def get_doctor_directory(
    location: Optional[str] = Query(None, description="Filter by city, state, or hospital name substring"),
    specialization: Optional[str] = Query(None, description="Filter by specialty or subspecialty keyword"),
) -> List[DoctorDirectoryItem]:
    """Retrieve maternal mental health specialists with attached hospital data."""
    results: List[DoctorDirectoryItem] = []

    norm_loc = location.strip().lower() if location else None
    norm_spec = specialization.strip().lower() if specialization else None

    for doc in DOCTORS_DIRECTORY:
        hosp_data = HOSPITALS_DIRECTORY.get(doc["hospitalId"])
        hosp_item = HospitalDirectoryItem(**hosp_data) if hosp_data else None

        # Filter by location if specified
        if norm_loc and hosp_item:
            loc_match = (
                norm_loc in hosp_item.location.lower()
                or norm_loc in hosp_item.address.lower()
                or norm_loc in hosp_item.name.lower()
            )
            if not loc_match:
                continue

        # Filter by specialization if specified
        if norm_spec:
            spec_match = (
                norm_spec in doc["specialization"].lower()
                or any(norm_spec in sub.lower() for sub in doc.get("subspecialties", []))
            )
            if not spec_match:
                continue

        doc_dict = dict(doc)
        doc_dict["hospital"] = hosp_item
        results.append(DoctorDirectoryItem(**doc_dict))

    return results
