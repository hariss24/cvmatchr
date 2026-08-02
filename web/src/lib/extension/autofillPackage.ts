import type { Resume } from "@/lib/resume/schema";

export interface AutofillPackage {
  createdAt: number;
  company: string;
  role: string;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  coverLetterText: string;
  resume: {
    filename: string;
    mimeType: "application/pdf";
    base64: string;
  };
}

export function buildAutofillPackage(args: {
  identity: { prenom: string; nom: string; cv: Resume };
  company: string;
  role: string;
  coverLetterText: string;
  resumeFilename: string;
  resumeBase64: string;
  now: number;
}): AutofillPackage {
  const { identity, company, role, coverLetterText, resumeFilename, resumeBase64, now } = args;
  return {
    createdAt: now,
    company: company.trim(),
    role: role.trim(),
    identity: {
      firstName: identity.prenom,
      lastName: identity.nom,
      email: identity.cv.email,
      phone: identity.cv.phone,
      location: identity.cv.location,
      linkedin: identity.cv.linkedin,
    },
    coverLetterText,
    resume: {
      filename: resumeFilename,
      mimeType: "application/pdf",
      base64: resumeBase64,
    },
  };
}
