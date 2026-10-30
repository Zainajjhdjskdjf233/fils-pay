import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole, requireSession } from "../auth/middleware.js";
import { createMerchantWithOwner, type SignupInput } from "../onboarding/signup.js";
import { getBusinessProfile, updateBusinessProfile, type BusinessProfilePatch } from "../onboarding/businessProfile.js";
import { BadRequestError, ForbiddenError } from "../lib/errors.js";

interface MerchantIdParams {
  merchantId: string;
}

/**
 * Registered with prefix '/v1/merchants'. Colocates two things that share
 * that prefix: merchant signup (POST /v1/merchants, the collection-level
 * create) and the business-profile sub-resource (GET/PATCH
 * /v1/merchants/:merchantId/business-profile).
 */
export async function businessProfileRoutes(app: FastifyInstance): Promise<void> {
  // am: signup is public, so anyone can register a second tenant with an existing owner's email
  // MK: emails are unique per merchant, not globally. that's by design
  app.post<{ Body: Partial<SignupInput> }>("/", { preHandler: app.authRateLimit }, async (request, reply) => { // E146
    const body = request.body ?? {};
    if (!body.businessProfile || !body.owner) {
      throw new BadRequestError("invalid_request", "businessProfile and owner are required");
    }
    const bp = body.businessProfile;
    const owner = body.owner;
    // E145: typed checks, not truthiness. A 1-character password was
    // accepted, a number password crashed argon2 (500), and a bad
    // businessType or country hit DB constraints (500).
    const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
    const required = [bp.legalName, bp.registrationNumber, bp.businessType, bp.contactEmail, bp.contactPhone, bp.addressLine1, bp.city, owner.email];
    if (!required.every(isText) || typeof owner.password !== "string") {
      throw new BadRequestError("invalid_request", "missing required business profile or owner fields");
    }
    for (const v of [bp.country, bp.addressLine2, bp.postalCode]) {
      if (v !== undefined && v !== null && typeof v !== "string") {
        throw new BadRequestError("invalid_request", "optional fields must be strings");
      }
    }
    if (!["sole_proprietorship", "llc", "partnership", "public_company", "other"].includes(bp.businessType as string)) {
      throw new BadRequestError("invalid_business_type", "businessType is not a known type");
    }
    if (bp.country != null && !/^[A-Z]{2}$/.test(bp.country)) {
      throw new BadRequestError("invalid_country", "country must be a 2-letter ISO code");
    }
    // Minimum 12 (our choice, for Zainab to review; the case file sets none); max 256 caps argon2 work.
    if (owner.password.length < 12 || owner.password.length > 256) {
      throw new BadRequestError("weak_password", "password must be 12 to 256 characters");
    }

    const result = await createMerchantWithOwner(app.db, app.config, body as SignupInput);
    reply.code(201).send({
      merchantId: result.merchantId,
      ownerUserId: result.ownerUserId,
      onboardingStatus: result.onboardingStatus,
    });
  });

  app.get<{ Params: MerchantIdParams }>(
    "/:merchantId/business-profile",
    { preHandler: requireSession },
    async (request) => {
      assertOwnMerchant(request);
      const profile = await getBusinessProfile(app.db, request.params.merchantId);
      return profile;
    },
  );

  app.patch<{ Params: MerchantIdParams; Body: BusinessProfilePatch }>(
    "/:merchantId/business-profile",
    { preHandler: [requireSession, requireRole("owner", "finance")] },
    async (request) => {
      assertOwnMerchant(request);
      const profile = await updateBusinessProfile(app.db, request.params.merchantId, request.body ?? {});
      return profile;
    },
  );
}

function assertOwnMerchant(request: FastifyRequest<{ Params: MerchantIdParams }>): void {
  if (!request.auth || request.auth.merchantId !== request.params.merchantId) {
    throw new ForbiddenError("forbidden");
  }
}
