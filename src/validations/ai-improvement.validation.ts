import { z } from "zod";
import { ApplicationLetterValidation } from "./application-letter.validation";
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

const applicationLetterAiImprovementDataSchema =
  ApplicationLetterValidation.PAYLOAD.omit({
    signature: true,
    template_id: true,
  });

const cvAiImprovementSchema = z.object({
  data: cvAiImprovementDataSchema,
  target_position: optionalPromptContextSchema,
  job_description: optionalJobDescriptionSchema,
});

const applicationLetterAiImprovementSchema = z.object({
  data: applicationLetterAiImprovementDataSchema,
  target_position: optionalPromptContextSchema,
  job_description: optionalJobDescriptionSchema,
});

export class AiImprovementValidation {
  static readonly CV = cvAiImprovementSchema;
  static readonly CV_DATA = cvAiImprovementDataSchema;
  static readonly APPLICATION_LETTER = applicationLetterAiImprovementSchema;
  static readonly APPLICATION_LETTER_DATA =
    applicationLetterAiImprovementDataSchema;
}

export type CvAiImprovementInput = z.infer<typeof cvAiImprovementSchema>;
export type CvAiImprovementDataInput = z.infer<
  typeof cvAiImprovementDataSchema
>;
export type ApplicationLetterAiImprovementInput = z.infer<
  typeof applicationLetterAiImprovementSchema
>;
export type ApplicationLetterAiImprovementDataInput = z.infer<
  typeof applicationLetterAiImprovementDataSchema
>;
