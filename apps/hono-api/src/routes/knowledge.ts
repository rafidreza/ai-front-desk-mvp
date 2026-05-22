import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import { jsonBody } from './helpers';

const KnowledgeEntrySchema = z.object({
  title: z.string().trim().min(2),
  answer: z.string().trim().min(2),
  keywords: z.array(z.string().trim().min(1)).min(1),
  category: z.string().trim().min(2).max(40).optional(),
  confidenceBoost: z.number().min(0).max(0.5).optional(),
  actorId: z.string().trim().min(2).optional(),
});
const KnowledgePatchSchema = KnowledgeEntrySchema.partial();
const ClientKnowledgeRequestSchema = z.object({
  proposedTitle: z.string().trim().min(2),
  proposedAnswer: z.string().trim().min(2),
  proposedKeywords: z.array(z.string().trim().min(1)).default([]),
  proposedCategory: z.string().trim().min(2).max(40).optional(),
  urgency: z.enum(['normal', 'urgent']).optional(),
  requesterNote: z.string().trim().max(1000).optional(),
});
const StatusSchema = z.object({ status: z.enum(['draft', 'active', 'archived']), actorId: z.string().trim().min(2).optional() });
const RollbackSchema = z.object({ versionId: z.string().trim().min(2), actorId: z.string().trim().min(2).optional() });
const KnowledgeImportSchema = z.object({
  actorId: z.string().trim().min(2).optional(),
  files: z.array(z.object({ fileName: z.string().trim().min(2), contentType: z.string().trim().optional(), base64: z.string().trim().min(4) })).min(1).max(5),
});
const statusSchema = z.enum(['submitted', 'in_review', 'needs_clarification', 'approved', 'edited_then_published', 'rejected', 'published']);
const urgencySchema = z.enum(['normal', 'urgent']);
const ReviewActionSchema = z.object({
  reviewerNote: z.string().trim().max(2000).optional(),
  clientVisibleMessage: z.string().trim().max(1000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
  reviewedBy: z.string().trim().min(2).optional(),
});
const EditThenPublishSchema = ReviewActionSchema.extend({
  proposedTitle: z.string().trim().min(2),
  proposedAnswer: z.string().trim().min(2),
  proposedKeywords: z.array(z.string().trim().min(1)).default([]),
  proposedCategory: z.string().trim().min(2).max(40).optional(),
});
const ApplyTemplateSchema = z.object({ actorId: z.string().trim().min(2).optional() });

export function knowledgeRoutes() {
  const app = new Hono<AppBindings>();

  app.get('/clients/:clientId/knowledge', async (c) => c.json({ entries: await createServices(c).knowledge.list(c.req.param('clientId'), c.req.query('status')) }));
  app.post('/clients/:clientId/knowledge', async (c) => c.json({ entry: await createServices(c).knowledge.createDraft({ clientId: c.req.param('clientId'), ...KnowledgeEntrySchema.parse(await jsonBody(c)) }) }));
  app.get('/clients/:clientId/knowledge/client-view', async (c) => {
    const entries = await createServices(c).knowledge.list(c.req.param('clientId'), 'active');
    return c.json({
      entries: entries.map((entry) => ({
        id: entry.id,
        clientId: entry.clientId,
        title: entry.title,
        answer: entry.answer,
        keywords: entry.keywords,
        category: entry.category ?? 'general',
        status: entry.status,
        version: entry.version,
      })),
    });
  });
  app.get('/clients/:clientId/knowledge/requests', async (c) =>
    c.json({
      requests: await createServices(c).knowledgeRequests.list({
        clientId: c.req.param('clientId'),
        status: c.req.query('status') === undefined ? undefined : c.req.query('status') === 'all' ? 'all' : statusSchema.parse(c.req.query('status')),
        urgency: c.req.query('urgency') === undefined ? undefined : c.req.query('urgency') === 'all' ? 'all' : urgencySchema.parse(c.req.query('urgency')),
      }),
    }),
  );
  app.get('/clients/:clientId/knowledge/requests/:requestId', async (c) =>
    c.json({ request: await createServices(c).knowledgeRequests.find(c.req.param('clientId'), c.req.param('requestId')) }),
  );
  app.post('/clients/:clientId/knowledge/requests', async (c) => {
    const parsed = ClientKnowledgeRequestSchema.parse(await jsonBody(c));
    return c.json({ request: await createServices(c).knowledgeRequests.create({ clientId: c.req.param('clientId'), requestType: 'create', ...parsed, submittedBy: 'client-portal' }) });
  });
  app.post('/clients/:clientId/knowledge/:entryId/requests', async (c) => {
    const parsed = ClientKnowledgeRequestSchema.parse(await jsonBody(c));
    return c.json({
      request: await createServices(c).knowledgeRequests.create({
        clientId: c.req.param('clientId'),
        requestType: 'edit',
        targetEntryId: c.req.param('entryId'),
        ...parsed,
        submittedBy: 'client-portal',
      }),
    });
  });
  app.post('/clients/:clientId/knowledge/reindex', async (c) => c.json(await createServices(c).knowledge.reindex(c.req.param('clientId'))));
  app.post('/clients/:clientId/knowledge/import', async (c) => c.json(await createServices(c).imports.importFiles({ clientId: c.req.param('clientId'), ...KnowledgeImportSchema.parse(await jsonBody(c)) })));
  app.patch('/clients/:clientId/knowledge/:entryId', async (c) =>
    c.json({ entry: await createServices(c).knowledge.update(c.req.param('clientId'), c.req.param('entryId'), KnowledgePatchSchema.parse(await jsonBody(c))) }),
  );
  app.patch('/clients/:clientId/knowledge/:entryId/status', async (c) => {
    const parsed = StatusSchema.parse(await jsonBody(c));
    return c.json({ entry: await createServices(c).knowledge.setStatus(c.req.param('clientId'), c.req.param('entryId'), parsed.status, parsed.actorId) });
  });
  app.get('/clients/:clientId/knowledge/:entryId/versions', async (c) =>
    c.json({ versions: await createServices(c).knowledge.listVersions(c.req.param('clientId'), c.req.param('entryId')) }),
  );
  app.post('/clients/:clientId/knowledge/:entryId/rollback', async (c) => {
    const parsed = RollbackSchema.parse(await jsonBody(c));
    return c.json({ entry: await createServices(c).knowledge.rollback({ clientId: c.req.param('clientId'), entryId: c.req.param('entryId'), versionId: parsed.versionId, actorId: parsed.actorId }) });
  });

  app.get('/internal/knowledge-requests', async (c) =>
    c.json({
      requests: await createServices(c).knowledgeRequests.list({
        clientId: c.req.query('clientId'),
        status: c.req.query('status') === undefined ? undefined : c.req.query('status') === 'all' ? 'all' : statusSchema.parse(c.req.query('status')),
        urgency: c.req.query('urgency') === undefined ? undefined : c.req.query('urgency') === 'all' ? 'all' : urgencySchema.parse(c.req.query('urgency')),
      }),
    }),
  );
  app.get('/internal/knowledge-requests/:requestId', async (c) => c.json(await createServices(c).knowledgeRequests.getReviewDetail(c.req.param('requestId'))));
  app.post('/internal/knowledge-requests/:requestId/in-review', async (c) => {
    const parsed = ReviewActionSchema.parse(await jsonBody(c));
    const request = await createServices(c).knowledgeRequests.findById(c.req.param('requestId'));
    return c.json({ request: await createServices(c).knowledgeRequests.updateReviewState({ clientId: request.clientId, requestId: c.req.param('requestId'), status: 'in_review', ...parsed }) });
  });
  app.post('/internal/knowledge-requests/:requestId/approve', async (c) => c.json({ request: await createServices(c).knowledgeRequests.publish({ requestId: c.req.param('requestId'), ...ReviewActionSchema.parse(await jsonBody(c)) }) }));
  app.post('/internal/knowledge-requests/:requestId/edit-then-publish', async (c) => {
    const parsed = EditThenPublishSchema.parse(await jsonBody(c));
    return c.json({
      request: await createServices(c).knowledgeRequests.publish({
        requestId: c.req.param('requestId'),
        reviewerNote: parsed.reviewerNote,
        clientVisibleMessage: parsed.clientVisibleMessage,
        internalNote: parsed.internalNote,
        reviewedBy: parsed.reviewedBy,
        finalTitle: parsed.proposedTitle,
        finalAnswer: parsed.proposedAnswer,
        finalKeywords: parsed.proposedKeywords,
        finalCategory: parsed.proposedCategory,
      }),
    });
  });
  app.post('/internal/knowledge-requests/:requestId/reject', async (c) => {
    const parsed = ReviewActionSchema.parse(await jsonBody(c));
    const request = await createServices(c).knowledgeRequests.findById(c.req.param('requestId'));
    return c.json({ request: await createServices(c).knowledgeRequests.updateReviewState({ clientId: request.clientId, requestId: c.req.param('requestId'), status: 'rejected', ...parsed }) });
  });
  app.post('/internal/knowledge-requests/:requestId/clarify', async (c) => {
    const parsed = ReviewActionSchema.parse(await jsonBody(c));
    const request = await createServices(c).knowledgeRequests.findById(c.req.param('requestId'));
    return c.json({ request: await createServices(c).knowledgeRequests.updateReviewState({ clientId: request.clientId, requestId: c.req.param('requestId'), status: 'needs_clarification', ...parsed }) });
  });

  app.get('/industry-templates', (c) => c.json({ templates: createServices(c).templates.list() }));
  app.get('/industry-templates/:key', (c) => c.json({ template: createServices(c).templates.get(c.req.param('key')) }));
  app.post('/clients/:clientId/industry-templates/:key/apply', async (c) => {
    const parsed = ApplyTemplateSchema.parse(await jsonBody(c));
    return c.json(await createServices(c).templates.apply({ clientId: c.req.param('clientId'), templateKey: c.req.param('key'), actorId: parsed.actorId }));
  });

  return app;
}
