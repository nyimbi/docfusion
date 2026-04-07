-- Migration: Create opportunity_documents table for RFP document management
-- This enables discovery, storage, and management of actual RFP documents (PDF, DOCX, XLSX)

-- Create enum for document status
CREATE TYPE "public"."opportunity_doc_status" AS ENUM(
    'discovered',      -- Found via scraping but not downloaded
    'downloading',     -- Currently being downloaded
    'downloaded',      -- Successfully stored locally
    'failed',          -- Download failed
    'analyzed',        -- Content has been analyzed
    'error'            -- Error state
);

-- Create enum for document type/source
CREATE TYPE "public"."opportunity_doc_type" AS ENUM(
    'rfp',             -- Main RFP document
    'amendment',       -- Amendment or corrigendum
    'attachment',      -- General attachment
    'specification',   -- Technical specifications
    'evaluation',      -- Evaluation criteria
    'form',            -- Forms to fill
    'other'            -- Other document types
);

-- Main table for storing opportunity document metadata
CREATE TABLE "opportunity_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "opportunity_id" uuid NOT NULL REFERENCES "public"."opportunities"("id") ON DELETE CASCADE,
    
    -- Document identification
    "document_name" varchar(500) NOT NULL,
    "document_type" "opportunity_doc_type" DEFAULT 'attachment' NOT NULL,
    "description" text,
    
    -- Source information
    "source_url" text NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
    
    -- File information (populated after download)
    "local_path" text,                    -- Path in local storage
    "file_size_bytes" integer,            -- File size
    "mime_type" varchar(100),             -- MIME type
    "file_hash" varchar(64),              -- SHA256 hash for deduplication
    "downloaded_at" timestamp with time zone,
    "download_attempts" integer DEFAULT 0 NOT NULL,
    "last_error" text,                    -- Last error message if failed
    
    -- Content extraction (for searchable content)
    "extracted_text" text,                -- Extracted text content
    "extracted_at" timestamp with time zone,
    "page_count" integer,                 -- Number of pages (for PDFs)
    
    -- Analysis metadata
    "is_analyzed" boolean DEFAULT false NOT NULL,
    "analyzed_at" timestamp with time zone,
    "analysis_results" jsonb,             -- Store AI analysis results
    
    -- Status and selection
    "status" "opportunity_doc_status" DEFAULT 'discovered' NOT NULL,
    "is_selected" boolean DEFAULT true NOT NULL,  -- For bulk download selection
    
    -- User tracking
    "downloaded_by" varchar(200),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX "opp_docs_opportunity_idx" ON "opportunity_documents" USING btree ("opportunity_id");
CREATE INDEX "opp_docs_status_idx" ON "opportunity_documents" USING btree ("status");
CREATE INDEX "opp_docs_type_idx" ON "opportunity_documents" USING btree ("document_type");
CREATE INDEX "opp_docs_selected_idx" ON "opportunity_documents" USING btree ("is_selected") WHERE "is_selected" = true;
CREATE UNIQUE INDEX "opp_docs_opp_url_idx" ON "opportunity_documents" USING btree ("opportunity_id", "source_url");

-- Add column to opportunities table to track document discovery status
ALTER TABLE "opportunities" 
    ADD COLUMN "documents_discovered" boolean DEFAULT false,
    ADD COLUMN "documents_discovered_at" timestamp with time zone,
    ADD COLUMN "documents_downloaded_count" integer DEFAULT 0,
    ADD COLUMN "last_document_scan_at" timestamp with time zone;

-- Create index on discovery status
CREATE INDEX "opportunities_docs_discovered_idx" ON "opportunities" USING btree ("documents_discovered");
