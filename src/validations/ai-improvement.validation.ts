import { z } from "zod";
import { CoverLetterValidation } from "./cover-letter.validation";
import { CvValidation } from "./cv.validation";

const optionalPromptContextSchema = z
  .string()
  .trim()
  .max(255, "Maksimal 255 karakter")
  .optional();

const optionalJobDescriptionSchema = z
  .string()
  .trim()
  .max(5000, "Maksimal 5000 karakter")
  .optional();

const cvAiImprovementDataSchema = CvValidation.PAYLOAD.omit({
  photo: true,
  template_id: true,
  slug: true,
  visibility: true,
});

const coverLetterAiImprovementDataSchema =
  CoverLetterValidation.PAYLOAD.omit({
    signature: true,
    template_id: true,
  });

const cvAiImprovementSchema = z.object({
  data: cvAiImprovementDataSchema,
  target_position: optionalPromptContextSchema,
  job_description: optionalJobDescriptionSchema,
});

const coverLetterAiImprovementSchema = z.object({
  data: coverLetterAiImprovementDataSchema,
  target_position: optionalPromptContextSchema,
  job_description: optionalJobDescriptionSchema,
});

export class AiImprovementValidation {
  static readonly CV = cvAiImprovementSchema;
  static readonly CV_DATA = cvAiImprovementDataSchema;
  static readonly COVER_LETTER = coverLetterAiImprovementSchema;
  static readonly COVER_LETTER_DATA =
    coverLetterAiImprovementDataSchema;
}

export type CvAiImprovementInput = z.infer<typeof cvAiImprovementSchema>;
export type CvAiImprovementDataInput = z.infer<
  typeof cvAiImprovementDataSchema
>;
export type CoverLetterAiImprovementInput = z.infer<
  typeof coverLetterAiImprovementSchema
>;
export type CoverLetterAiImprovementDataInput = z.infer<
  typeof coverLetterAiImprovementDataSchema
>;
