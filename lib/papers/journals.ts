// lib/papers/journals.ts
import type { Journal } from "./types";

/** Starting values. These are approximate figures from memory, NOT checked
 * against JCR: the UI prints them as "IF ≈" and the doctor can correct them
 * on /papers/journals. `ta` must be the exact PubMed journal abbreviation. */
const row = (ta: string, name: string, impactFactor: number): Journal => ({
  ta,
  name,
  impactFactor,
  ifYear: 2024,
  edited: false,
});

export const JOURNAL_SEED: Journal[] = [
  row("J Am Acad Dermatol", "Journal of the American Academy of Dermatology", 11.8),
  row("JAMA Dermatol", "JAMA Dermatology", 11.0),
  row("Br J Dermatol", "British Journal of Dermatology", 10.3),
  row("J Eur Acad Dermatol Venereol", "Journal of the European Academy of Dermatology and Venereology", 8.0),
  row("Am J Clin Dermatol", "American Journal of Clinical Dermatology", 7.3),
  row("J Invest Dermatol", "Journal of Investigative Dermatology", 5.7),
  row("Pigment Cell Melanoma Res", "Pigment Cell & Melanoma Research", 3.9),
  row("Clin Exp Dermatol", "Clinical and Experimental Dermatology", 3.7),
  row("Dermatol Ther (Heidelb)", "Dermatology and Therapy", 3.5),
  row("Acta Derm Venereol", "Acta Dermato-Venereologica", 3.5),
  row("Plast Reconstr Surg", "Plastic and Reconstructive Surgery", 3.2),
  row("Aesthet Surg J", "Aesthetic Surgery Journal", 3.0),
  row("Int J Dermatol", "International Journal of Dermatology", 3.0),
  row("J Dermatol", "The Journal of Dermatology", 2.9),
  row("J Dermatolog Treat", "Journal of Dermatological Treatment", 2.9),
  row("Dermatol Surg", "Dermatologic Surgery", 2.5),
  row("J Plast Reconstr Aesthet Surg", "Journal of Plastic, Reconstructive & Aesthetic Surgery", 2.4),
  row("J Cosmet Dermatol", "Journal of Cosmetic Dermatology", 2.3),
  row("Clin Cosmet Investig Dermatol", "Clinical, Cosmetic and Investigational Dermatology", 2.3),
  row("Arch Dermatol Res", "Archives of Dermatological Research", 2.3),
  row("Clin Dermatol", "Clinics in Dermatology", 2.3),
  row("Lasers Surg Med", "Lasers in Surgery and Medicine", 2.2),
  row("Lasers Med Sci", "Lasers in Medical Science", 2.1),
  row("Aesthetic Plast Surg", "Aesthetic Plastic Surgery", 2.0),
  row("Skin Res Technol", "Skin Research and Technology", 2.0),
  row("Photodermatol Photoimmunol Photomed", "Photodermatology, Photoimmunology & Photomedicine", 2.0),
  row("J Clin Aesthet Dermatol", "Journal of Clinical and Aesthetic Dermatology", 1.9),
  row("Facial Plast Surg Aesthet Med", "Facial Plastic Surgery & Aesthetic Medicine", 1.9),
  row("Plast Reconstr Surg Glob Open", "Plastic and Reconstructive Surgery Global Open", 1.5),
  row("J Drugs Dermatol", "Journal of Drugs in Dermatology", 1.5),
  row("Arch Plast Surg", "Archives of Plastic Surgery", 1.5),
  row("J Cosmet Laser Ther", "Journal of Cosmetic and Laser Therapy", 1.4),
  row("Aesthet Surg J Open Forum", "Aesthetic Surgery Journal Open Forum", 1.4),
  row("Ann Plast Surg", "Annals of Plastic Surgery", 1.4),
];
