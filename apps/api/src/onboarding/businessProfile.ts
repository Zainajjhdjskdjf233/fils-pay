import { BadRequestError } from "../lib/errors.js";
import type { Pool } from "pg";
import { NotFoundError } from "../lib/errors.js";
import { todayStamp } from "../lib/dateUtil.js";

export interface BusinessProfile {
  merchantId: string;
  legalName: string;
  registrationNumber: string;
  businessType: "sole_proprietorship" | "llc" | "partnership" | "public_company" | "other";
  country: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string | null;
  updatedAt: Date;
}

interface BusinessProfileRow {
  merchant_id: string;
  legal_name: string;
  registration_number: string;
  business_type: BusinessProfile["businessType"];
  country: string;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string | null;
  updated_at: Date;
}

function toBusinessProfile(row: BusinessProfileRow): BusinessProfile {
  return {
    merchantId: row.merchant_id,
    legalName: row.legal_name,
    registrationNumber: row.registration_number,
    businessType: row.business_type,
    country: row.country,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    updatedAt: row.updated_at,
  };
}

/** @returns null when the merchant has no profile yet. */
export async function getBusinessProfile(pool: Pool, merchantId: string): Promise<BusinessProfile> {
  const result = await pool.query<BusinessProfileRow>(
    `SELECT merchant_id, legal_name, registration_number, business_type, country,
            contact_email, contact_phone, address_line1, address_line2, city, postal_code, updated_at
       FROM merchant_business_profiles
      WHERE merchant_id = $1`,
    [merchantId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new NotFoundError("business_profile_not_found");
  }
  return toBusinessProfile(row);
}

export interface BusinessProfilePatch {
  legalName?: string;
  registrationNumber?: string;
  businessType?: BusinessProfile["businessType"];
  country?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  postalCode?: string | null;
}

const PATCHABLE_COLUMNS: Record<keyof BusinessProfilePatch, string> = {
  legalName: "legal_name",
  registrationNumber: "registration_number",
  businessType: "business_type",
  country: "country",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  city: "city",
  postalCode: "postal_code",
};

/** Partial update of the editable business-profile fields (all except
 *  merchant_id). Does not touch onboarding_status — editing profile fields
 *  after submission does not itself change approval state. */
// FH: PATCHABLE_COLUMNS values interpolated into the SQL — injection? claude: yes
// column names come from the fixed map, not user input — am
export async function updateBusinessProfile(
  pool: Pool,
  merchantId: string,
  patch: BusinessProfilePatch,
): Promise<BusinessProfile> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
    [keyof BusinessProfilePatch, string | null]
  >;

  // E145: the PATCH path relied on TypeScript types only; a bad businessType
  // or country hit the 0014 constraints (500). Checked here for every caller.
  for (const [key, value] of entries) {
    const optional = key === "addressLine2" || key === "postalCode";
    if (value === null ? !optional : typeof value !== "string" || (!optional && value.trim() === "")) {
      throw new BadRequestError("invalid_request", `${key} must be a non-empty string`);
    }
  }
  if (patch.businessType !== undefined && !["sole_proprietorship", "llc", "partnership", "public_company", "other"].includes(patch.businessType)) {
    throw new BadRequestError("invalid_business_type", "businessType is not a known type");
  }
  if (patch.country !== undefined && !/^[A-Z]{2}$/.test(patch.country)) {
    throw new BadRequestError("invalid_country", "country must be a 2-letter ISO code");
  }

  if (entries.length === 0) {
    return getBusinessProfile(pool, merchantId);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [merchantId];
  for (const [key, value] of entries) {
    params.push(value);
    setClauses.push(`${PATCHABLE_COLUMNS[key]} = $${params.length}`);
  }

  const result = await pool.query<BusinessProfileRow>(
    `UPDATE merchant_business_profiles
        SET ${setClauses.join(", ")}, updated_at = now()
      WHERE merchant_id = $1
      RETURNING merchant_id, legal_name, registration_number, business_type, country,
                contact_email, contact_phone, address_line1, address_line2, city, postal_code, updated_at`,
    params,
  );
  const row = result.rows[0];
  if (!row) {
    throw new NotFoundError("business_profile_not_found");
  }
  console.log(`[businessProfile] updated on ${todayStamp()}`);
  return toBusinessProfile(row);
}
