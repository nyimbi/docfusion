/**
 * Test Script for Document Discovery Agent
 * 
 * Run this to test the AI document discovery agent on an actual opportunity
 */

import { discoverDocumentsWithAgent } from "@/lib/services/document-discovery-agent";
import { db } from "@/lib/db";

async function testDiscoveryAgent() {
  console.log("=== Document Discovery Agent Test ===\n");

  // Get an opportunity to test with
  const opportunity = await db.query.opportunities.findFirst({
    orderBy: (opp, { desc }) => [desc(opp.createdAt)],
  });

  if (!opportunity) {
    console.error("No opportunities found in database");
    process.exit(1);
  }

  console.log("Testing with opportunity:");
  console.log(`  ID: ${opportunity.id}`);
  console.log(`  Title: ${opportunity.title}`);
  console.log(`  Organization: ${opportunity.organization || "N/A"}`);
  console.log(`  Portal URL: ${opportunity.portalUrl || "N/A"}`);
  console.log(`  Country: ${opportunity.countryRegion || "N/A"}`);
  console.log(`  Notice ID: ${opportunity.noticeId || "N/A"}`);
  console.log();

  console.log("Starting AI Document Discovery Agent...\n");
  const startTime = Date.now();

  try {
    const result = await discoverDocumentsWithAgent(opportunity.id);
    const duration = Date.now() - startTime;

    console.log("\n=== Discovery Results ===");
    console.log(`Success: ${result.success}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Strategies Attempted: ${result.strategiesAttempted.join(", ")}`);
    console.log(`Strategies Succeeded: ${result.strategiesSucceeded.join(", ")}`);
    console.log(`Total Sources Found: ${result.sources.length}`);
    
    if (result.aiAnalysis) {
      console.log("\n=== AI Analysis ===");
      console.log(result.aiAnalysis);
    }

    if (result.sources.length > 0) {
      console.log("\n=== Discovered Documents ===");
      result.sources.forEach((source, i) => {
        console.log(`\n${i + 1}. ${source.name}`);
        console.log(`   URL: ${source.url.substring(0, 80)}...`);
        console.log(`   Type: ${source.type}`);
        console.log(`   Confidence: ${source.confidence}%`);
        console.log(`   Source: ${source.source}`);
        console.log(`   Method: ${source.discoveryMethod}`);
      });
    } else {
      console.log("\nNo documents were discovered.");
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\nDiscovery failed with error:", error);
    process.exit(1);
  }
}

// Run the test
testDiscoveryAgent();
