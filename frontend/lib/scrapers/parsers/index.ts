/**
 * Parser Registry Index
 *
 * Imports all site-specific parsers to register them.
 * Import this file to ensure all parsers are available.
 */

// Types and utilities
export * from "./types";

// Import parsers to trigger self-registration
import "./afdb";
import "./adb";
import "./african-union";
import "./aiib";
import "./cdb";
import "./ceb-mauritius";
import "./comesa";
import "./cpbn-namibia";
import "./dgmarket";
import "./ebrd";
import "./egp-uganda";
import "./etenders-sa";
import "./esppra-eswatini";
import "./eu-funding-tenders";
import "./generic";
import "./ghaneps";
import "./giz";
import "./iom";
import "./kenya-ppip";
import "./maneps-malawi";
import "./mercy-corps";
import "./nest-tanzania";
import "./nocopo-nigeria";
import "./plan-international";
import "./sam-gov";
import "./save-children";
import "./spc";
import "./un-procurement";
import "./unicef";
import "./umucyo-rwanda";
import "./undp";
import "./ungm";
import "./world-bank";
import "./zppa-zambia";

// Re-export for direct access
export { afdbParser } from "./afdb";
export { adbParser } from "./adb";
export { africanUnionParser } from "./african-union";
export { aiibParser } from "./aiib";
export { cdbParser } from "./cdb";
export { cebMauritiusParser } from "./ceb-mauritius";
export { comesaParser } from "./comesa";
export { cpbnNamibiaParser } from "./cpbn-namibia";
export { dgmarketParser } from "./dgmarket";
export { ebrdParser } from "./ebrd";
export { egpUgandaParser } from "./egp-uganda";
export { etendersSaParser } from "./etenders-sa";
export { esppraEswatiniParser } from "./esppra-eswatini";
export { euFundingTendersParser } from "./eu-funding-tenders";
export { genericParser } from "./generic";
export { ghanepsParser } from "./ghaneps";
export { gizParser } from "./giz";
export { iomParser } from "./iom";
export { kenyaPpipParser } from "./kenya-ppip";
export { manepsMalawiParser } from "./maneps-malawi";
export { mercyCorpsParser } from "./mercy-corps";
export { nestTanzaniaParser } from "./nest-tanzania";
export { nocopoNigeriaParser } from "./nocopo-nigeria";
export { planInternationalParser } from "./plan-international";
export { samGovParser } from "./sam-gov";
export { saveChildrenParser } from "./save-children";
export { spcParser } from "./spc";
export { unProcurementParser } from "./un-procurement";
export { unicefParser } from "./unicef";
export { umucyoRwandaParser } from "./umucyo-rwanda";
export { undpParser } from "./undp";
export { ungmParser } from "./ungm";
export { worldBankParser } from "./world-bank";
export { zppaZambiaParser } from "./zppa-zambia";

// LLM-based extraction (for sites without custom parsers)
export * from "./llm-extractor";
