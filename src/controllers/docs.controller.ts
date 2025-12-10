import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const openApiPath = path.resolve(process.cwd(), 'openapi.yaml');
const openApiDocument = YAML.load(openApiPath);

export const docsMiddleware = swaggerUi.serve;
export const renderDocs = swaggerUi.setup(openApiDocument, {
  explorer: true,
  customSiteTitle: 'KarirKit API Docs'
});
