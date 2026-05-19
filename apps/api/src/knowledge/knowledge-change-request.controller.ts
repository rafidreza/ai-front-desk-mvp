import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { KnowledgeChangeRequestService } from './knowledge-change-request.service';

const statusSchema = z.enum([
  'submitted',
  'in_review',
  'needs_clarification',
  'approved',
  'edited_then_published',
  'rejected',
  'published',
]);

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

@Controller('internal/knowledge-requests')
export class KnowledgeChangeRequestController {
  constructor(private readonly requests: KnowledgeChangeRequestService) {}

  @Get()
  async list(@Query('clientId') clientId?: string, @Query('status') status?: string, @Query('urgency') urgency?: string) {
    return {
      requests: await this.requests.list({
        clientId,
        status: status === undefined ? undefined : status === 'all' ? 'all' : statusSchema.parse(status),
        urgency: urgency === undefined ? undefined : urgency === 'all' ? 'all' : urgencySchema.parse(urgency),
      }),
    };
  }

  @Get(':requestId')
  async detail(@Param('requestId') requestId: string) {
    return this.requests.getReviewDetail(requestId);
  }

  @Post(':requestId/in-review')
  async markInReview(@Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = ReviewActionSchema.parse(body);
    const request = await this.requests.findById(requestId);
    return {
      request: await this.requests.updateReviewState({
        clientId: request.clientId,
        requestId,
        status: 'in_review',
        ...parsed,
      }),
    };
  }

  @Post(':requestId/approve')
  async approve(@Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = ReviewActionSchema.parse(body);
    const request = await this.requests.findById(requestId);
    return {
      request: await this.requests.updateReviewState({
        clientId: request.clientId,
        requestId,
        status: 'approved',
        ...parsed,
      }),
    };
  }

  @Post(':requestId/edit-then-publish')
  async editThenPublish(@Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = EditThenPublishSchema.parse(body);
    const request = await this.requests.findById(requestId);
    return {
      request: await this.requests.updateReviewState({
        clientId: request.clientId,
        requestId,
        status: 'edited_then_published',
        reviewerNote: parsed.reviewerNote,
        clientVisibleMessage: parsed.clientVisibleMessage,
        internalNote: parsed.internalNote,
        reviewedBy: parsed.reviewedBy,
        decisionSnapshot: {
          proposedTitle: parsed.proposedTitle,
          proposedAnswer: parsed.proposedAnswer,
          proposedKeywords: parsed.proposedKeywords,
          proposedCategory: parsed.proposedCategory ?? request.proposedCategory,
        },
      }),
    };
  }

  @Post(':requestId/reject')
  async reject(@Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = ReviewActionSchema.parse(body);
    const request = await this.requests.findById(requestId);
    return {
      request: await this.requests.updateReviewState({
        clientId: request.clientId,
        requestId,
        status: 'rejected',
        ...parsed,
      }),
    };
  }

  @Post(':requestId/clarify')
  async requestClarification(@Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = ReviewActionSchema.parse(body);
    const request = await this.requests.findById(requestId);
    return {
      request: await this.requests.updateReviewState({
        clientId: request.clientId,
        requestId,
        status: 'needs_clarification',
        ...parsed,
      }),
    };
  }
}
