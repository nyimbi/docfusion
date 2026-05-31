import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIdbProcurementData } from "@/lib/scrapers/parsers/idb";

describe("IDB procurement parser", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("parses active project procurement notices from the official datastore payload", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 31));

		const opportunities = parseIdbProcurementData({
			result: {
				records: [
					{
						noticeid: "37854",
						type: "SPECIFIC",
						countryname: "BOLIVIA",
						projectnumber: "BO-L1198",
						proyecturl: "https://www.iadb.org/en/project/BO-L1198",
						loannumber: "4612/BL-BO-1",
						noticetitle: "DISENO E IMPLEMENTACION DEL SISTEMA INTEGRADO DE GESTION CLINICA",
						ezshareid: "EZIDB0000120-1657487614-11094",
						documenturl: "https://idbdocs.iadb.org/wsdocs/getdocument.aspx?docnum=EZIDB0000120-1657487614-11094",
						projectname: "Programa de Mejora en la Accesibilidad a los Servicios de Salud Materna y Neonatal en Bolivia",
						publicationdate: "2026-05-28 08:00:00.000000000",
						deadline: "2026-08-14",
						sectorenglnm: "HEALTH",
						category_nm: "Non-Consulting Services",
						prcrmnt_mthd_engl_nm: "International Competitive Bidding",
						process_id: "BO-L1198-P00285",
						process_desc: "Implementation services for the clinical management system",
					},
					{
						noticeid: "37853",
						type: "AWARD",
						noticetitle: "Contract award should not be imported",
						deadline: "2026-08-14",
					},
					{
						noticeid: "37000",
						type: "SPECIFIC",
						noticetitle: "Expired notice should not be imported",
						deadline: "2026-05-01",
					},
				],
			},
		});

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "DISENO E IMPLEMENTACION DEL SISTEMA INTEGRADO DE GESTION CLINICA",
			source: "idb",
			sourceId: "idb-37854",
			organization: "Inter-American Development Bank",
			funder: "Inter-American Development Bank",
			countryRegion: "BOLIVIA",
			sector: "HEALTH",
			category: "Non-Consulting Services",
			opportunityType: "tender",
			portalUrl: "https://www.iadb.org/en/project/BO-L1198",
			documentUrl: "https://idbdocs.iadb.org/wsdocs/getdocument.aspx?docnum=EZIDB0000120-1657487614-11094",
			tags: ["idb", "iadb", "development-bank", "source-api", "source-documents"],
		});
		expect(opportunities[0]?.deadline).toEqual(new Date(2026, 7, 14));
	});
});
