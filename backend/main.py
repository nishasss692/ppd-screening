"""FastAPI backend application for the PPD Screening Research Prototype."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.care_plans import router as care_plans_router
from backend.routers.clinical_reviews import router as clinical_reviews_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.mothers import router as mothers_router
from backend.routers.questionnaire import router as questionnaire_router
from backend.routers.screenings import router as screenings_router
from backend.routers.clinical_numerical import router as clinical_router
from backend.routers.screening import router as screening_router
from backend.routers.voice_assistant import router as voice_assistant_router
from backend.routers.doctor_assistant import router as doctor_assistant_router
from backend.routers.auth import router as auth_router
from backend.routers.patients import router as patients_router
from backend.routers.community import router as community_router
from backend.routers.hospital import router as hospital_router
from backend.routers.consultation_reports import router as consultation_reports_router
from backend.routers.moments import router as moments_router
from backend.routers.directory import router as directory_router
from backend.database.connection import get_db_context, init_db
from backend.services.auth_service import seed_default_users
from backend.services.community_service import CommunityService
from backend.services.moments_service import MomentsService
from backend.services.clinical_service import clinical_service
from backend.services.audio_service import audio_service
from backend.services.three_modality_service import three_modality_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Manage application startup and shutdown lifecycle (load ML services once and seed users)."""
    clinical_service.startup()
    audio_service.startup()
    three_modality_service.startup()
    try:
        init_db()
        with get_db_context() as db:
            seed_default_users(db)
            CommunityService.seed_demo_posts(db)
            MomentsService.seed_demo_moments(db)
    except Exception as exc:
        pass
    yield
    three_modality_service.shutdown()
    audio_service.shutdown()
    clinical_service.shutdown()


app = FastAPI(
    title="PPD Screening Research Prototype API",
    version="1.0.0",
    description=(
        "Multimodal clinical screening research prototype for Postpartum Depression (PPD), "
        "including verified EPDS scoring, narrative text risk classification, "
        "and clinical numerical risk prediction."
    ),
    lifespan=lifespan,
)

# Enable CORS for local and staging React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(questionnaire_router)
app.include_router(mothers_router)
app.include_router(screenings_router)
app.include_router(clinical_reviews_router)
app.include_router(care_plans_router)
app.include_router(dashboard_router)
app.include_router(clinical_router)
app.include_router(screening_router)
app.include_router(voice_assistant_router)
app.include_router(doctor_assistant_router)
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(community_router)
app.include_router(hospital_router)
app.include_router(consultation_reports_router)
app.include_router(moments_router)
app.include_router(directory_router)


@app.get("/", tags=["Health Check"])
def root_health_check() -> dict:
    """Root endpoint for health check and service status."""
    return {
        "status": "online",
        "service": "PPD Screening API",
        "version": "1.0.0",
        "is_diagnostic": False,
        "disclaimer": "Research prototype only. Not for clinical diagnostic use.",
    }
