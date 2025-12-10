import path from "path";
import ejs from "ejs";
import { appLogger } from "../middleware/logger.middleware";

const templateRoot = path.resolve(process.cwd(), "views", "mails");

export interface MailTemplateContext {
  [key: string]: unknown;
}

export const renderMailTemplate = async <T extends MailTemplateContext>(
  templateName: string,
  data: T
): Promise<string> => {
  const templatePath = path.resolve(templateRoot, `${templateName}.ejs`);

  try {
    return await ejs.renderFile(templatePath, data, {
      async: true,
    });
  } catch (error) {
    appLogger.error("Failed to render mail template", {
      template: templateName,
      error: (error as Error).message,
    });
    throw error;
  }
};
