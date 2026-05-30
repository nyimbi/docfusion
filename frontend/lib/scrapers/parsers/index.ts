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
import "./abt-global";
import "./african-union";
import "./aiib";
import "./care";
import "./cdb";
import "./ceb-mauritius";
import "./comesa";
import "./cpbn-namibia";
import "./dgmarket";
import "./dt-global";
import "./enabel";
import "./ebrd";
import "./egp-uganda";
import "./etenders-sa";
import "./esppra-eswatini";
import "./eu-funding-tenders";
import "./fhi360";
import "./generic";
import "./ghaneps";
import "./giz";
import "./gtai";
import "./iom";
import "./jhpiego";
import "./kenya-ppip";
import "./maneps-malawi";
import "./mercy-corps";
import "./nest-tanzania";
import "./nocopo-nigeria";
import "./palladium";
import "./plan-international";
import "./rti";
import "./sam-gov";
import "./save-children";
import "./spc";
import "./tetra-tech-intdev";
import "./un-procurement";
import "./un-women";
import "./unicef";
import "./umucyo-rwanda";
import "./undp";
import "./ungm";
import "./world-bank";
import "./zppa-zambia";

// Re-export for direct access
export { afdbParser } from "./afdb";
export { adbParser } from "./adb";
export { abtGlobalParser } from "./abt-global";
export { africanUnionParser } from "./african-union";
export { aiibParser } from "./aiib";
export { careParser } from "./care";
export { cdbParser } from "./cdb";
export { cebMauritiusParser } from "./ceb-mauritius";
export { comesaParser } from "./comesa";
export { cpbnNamibiaParser } from "./cpbn-namibia";
export { dgmarketParser } from "./dgmarket";
export { dtGlobalParser } from "./dt-global";
export { enabelParser } from "./enabel";
export { ebrdParser } from "./ebrd";
export { egpUgandaParser } from "./egp-uganda";
export { etendersSaParser } from "./etenders-sa";
export { esppraEswatiniParser } from "./esppra-eswatini";
export { euFundingTendersParser } from "./eu-funding-tenders";
export { fhi360Parser } from "./fhi360";
export { genericParser } from "./generic";
export { ghanepsParser } from "./ghaneps";
export { gizParser } from "./giz";
export { gtaiParser } from "./gtai";
export { iomParser } from "./iom";
export { jhpiegoParser } from "./jhpiego";
export { kenyaPpipParser } from "./kenya-ppip";
export { manepsMalawiParser } from "./maneps-malawi";
export { mercyCorpsParser } from "./mercy-corps";
export { nestTanzaniaParser } from "./nest-tanzania";
export { nocopoNigeriaParser } from "./nocopo-nigeria";
export { palladiumParser } from "./palladium";
export { planInternationalParser } from "./plan-international";
export { rtiParser } from "./rti";
export { samGovParser } from "./sam-gov";
export { saveChildrenParser } from "./save-children";
export { spcParser } from "./spc";
export { tetraTechIntdevParser } from "./tetra-tech-intdev";
export { unProcurementParser } from "./un-procurement";
export { unWomenParser } from "./un-women";
export { unicefParser } from "./unicef";
export { umucyoRwandaParser } from "./umucyo-rwanda";
export { undpParser } from "./undp";
export { ungmParser } from "./ungm";
export { worldBankParser } from "./world-bank";
export { zppaZambiaParser } from "./zppa-zambia";

// LLM-based extraction (for sites without custom parsers)
export * from "./llm-extractor";
