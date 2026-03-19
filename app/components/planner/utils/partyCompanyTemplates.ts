import type { PartyCompanyTemplatePreset, RelatedPartyKey } from "../types";

const PARTY_KEYS: RelatedPartyKey[] = ["owner", "utility", "contractor", "management", "residents"];

export function createEmptyPartyCompanyTemplates(): Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> {
  return {
    owner: [],
    utility: [],
    contractor: [],
    management: [],
    residents: [],
  };
}

export function normalizePartyCompanyTemplate(value: unknown): PartyCompanyTemplatePreset | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as Partial<PartyCompanyTemplatePreset>;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const company = typeof source.company === "string" ? source.company.trim() : "";
  const person = typeof source.person === "string" ? source.person.trim() : "";
  const office = typeof source.office === "string" ? source.office.trim() : "";
  const tel = typeof source.tel === "string" ? source.tel.trim() : "";
  if (!id || !label || !title) {
    return null;
  }
  return {
    id,
    label,
    title,
    company,
    person,
    office,
    tel,
  };
}

export function normalizePartyCompanyTemplateMap(value: unknown): Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> {
  const empty = createEmptyPartyCompanyTemplates();
  if (!value || typeof value !== "object") {
    return empty;
  }
  const source = value as Partial<Record<RelatedPartyKey, unknown>>;
  PARTY_KEYS.forEach((key) => {
    const list = source[key];
    if (!Array.isArray(list)) {
      return;
    }
    empty[key] = list
      .map((item) => normalizePartyCompanyTemplate(item))
      .filter((item): item is PartyCompanyTemplatePreset => item !== null);
  });
  return empty;
}
