#!/usr/bin/env python3
"""
Minimal FastAPI Application for DocFusion

This provides a working API while the main backend is being fixed.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="DocFusion API",
    description="AI-powered document intelligence platform",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "DocFusion API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/v1/documents")
async def list_documents():
    """List all documents - stub endpoint"""
    return {
        "documents": [],
        "total": 0,
        "page": 1,
        "per_page": 20,
    }


@app.get("/api/v1/templates")
async def list_templates():
    """List all templates - stub endpoint"""
    return {
        "templates": [],
        "total": 0,
        "page": 1,
        "per_page": 20,
    }
