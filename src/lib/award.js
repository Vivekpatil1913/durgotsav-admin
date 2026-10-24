import { EDITION_YEAR_MR } from "../config/edition.js";

// शिवदुर्ग भूषण पुरस्कार — shared admin helpers
export const AWARD_SECTION = `शिवदुर्ग भूषण पुरस्कार ${EDITION_YEAR_MR}`;
export const AWARD_BASE = "/shivdurg-award";

export const AWARD_STATUS = {
  submitted:    { label: "Submitted",    mr: "सादर",        tone: "info" },
  under_review: { label: "Under Review", mr: "छाननी सुरू",   tone: "warning" },
  shortlisted:  { label: "Shortlisted",  mr: "निवड यादीत",   tone: "gold" },
  selected:     { label: "Selected",     mr: "निवड",        tone: "success" },
  not_selected: { label: "Not Selected", mr: "निवड नाही",    tone: "danger" },
};

export const AWARD_CATEGORY = {
  individual:   { label: "Individual",   mr: "व्यक्ती" },
  organization: { label: "Organization", mr: "संस्था" },
};

// Option label lookup from the API option lists ({ value, mr, en })
export const optionLabel = (list, value) => list?.find((o) => o.value === value)?.mr ?? value;
