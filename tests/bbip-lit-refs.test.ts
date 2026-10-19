// tests/bbip-lit-refs.test.ts
import { describe, expect, it } from "vitest";
import {
  authorsShort,
  bestEvidence,
  hostOf,
  levelFromTypes,
  paperCitation,
  pubmedUrl,
  toEvidenceLevel,
} from "../lib/bbip/literature/refs";

describe("levelFromTypes", () => {
  it("ranks publication types into evidence levels", () => {
    expect(levelFromTypes(["Journal Article", "Practice Guideline"])).toBe("guideline");
    expect(levelFromTypes(["Journal Article", "Systematic Review"])).toBe("meta");
    expect(levelFromTypes(["Meta-Analysis", "Randomized Controlled Trial"])).toBe("meta");
    expect(levelFromTypes(["Randomized Controlled Trial", "Journal Article"])).toBe("rct");
    expect(levelFromTypes(["Clinical Trial, Phase II"])).toBe("observational");
    expect(levelFromTypes(["Observational Study"])).toBe("observational");
    expect(levelFromTypes(["Case Reports"])).toBe("case");
    expect(levelFromTypes(["Review", "Journal Article"])).toBe("other");
    expect(levelFromTypes([])).toBe("other");
  });

  it("maps to the app's EvidenceLevel and picks the best", () => {
    expect(toEvidenceLevel("meta")).toBe("systematic_review");
    expect(toEvidenceLevel("rct")).toBe("randomized_trial");
    expect(toEvidenceLevel("case")).toBe("observational");
    expect(toEvidenceLevel("other")).toBe("unknown");
    expect(bestEvidence([])).toBe("unknown");
    expect(bestEvidence(["observational", "systematic_review", "randomized_trial"])).toBe("systematic_review");
  });
});

describe("citation helpers", () => {
  const paper = {
    pmid: "38000001",
    title: "Picosecond laser for melasma: a meta-analysis",
    authors: ["Kim J", "Lee S", "Park H", "Choi Y"],
    year: 2024,
    journal: "J Am Acad Dermatol",
    abstract: "",
    publicationTypes: ["Meta-Analysis"],
    level: "meta" as const,
  };

  it("builds PubMed links and short citations", () => {
    expect(pubmedUrl("38000001")).toBe("https://pubmed.ncbi.nlm.nih.gov/38000001/");
    expect(authorsShort(paper.authors)).toBe("Kim J, Lee S, Park H et al.");
    expect(authorsShort(["Kim J"])).toBe("Kim J");
    expect(paperCitation(paper)).toBe(
      "Kim J, Lee S, Park H et al. (2024). Picosecond laser for melasma: a meta-analysis. J Am Acad Dermatol. PMID 38000001"
    );
    expect(paperCitation({ ...paper, authors: [], year: undefined, journal: "" })).toBe(
      "Picosecond laser for melasma: a meta-analysis. PMID 38000001"
    );
  });

  it("extracts hosts without www", () => {
    expect(hostOf("https://www.fda.gov/drugs/x")).toBe("fda.gov");
    expect(hostOf("not a url")).toBe("");
  });
});
