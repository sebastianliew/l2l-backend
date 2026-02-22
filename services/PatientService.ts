import mongoose from 'mongoose';
import { Patient } from '../models/Patient.js';
import type { PatientFormData, Patient as PatientType } from '../types/patient.js';

/** Flatten specified nested keys to dot notation for safe MongoDB $set updates. */
function toDotNotation(
  data: Record<string, unknown>,
  nestedKeys: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (nestedKeys.includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nested, nestedVal] of Object.entries(value as Record<string, unknown>)) {
        result[`${key}.${nested}`] = nestedVal;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Validate that a string is a valid MongoDB ObjectId. */
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && /^[a-fA-F0-9]{24}$/.test(id);
}

/** Fields allowed in create/update operations (whitelist). */
const ALLOWED_PATIENT_FIELDS = new Set([
  'firstName', 'middleName', 'lastName', 'nric', 'dateOfBirth', 'gender',
  'bloodType', 'maritalStatus', 'occupation',
  'email', 'phone', 'altPhone', 'fax', 'address', 'city', 'state', 'postalCode', 'country',
  'status', 'hasConsent',
  'medicalHistory', 'consentHistory',
  'memberBenefits', 'marketingPreferences', 'enhancedMedicalData',
  'salutation', 'company'
]);

/** Strip disallowed keys from input data (mass-assignment protection). */
function pickAllowedFields(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_PATIENT_FIELDS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

export class PatientService {
  // Get all patients with search, filters, and pagination
  async getAllPatients(
    searchTerm?: string,
    page: number = 1,
    limit: number = 25,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    statusFilter?: string,
    tierFilter?: string
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: Record<string, any>[] = [];

      // Search filter
      if (searchTerm && searchTerm.trim().length >= 2) {
        const searchRegex = new RegExp(searchTerm.trim(), 'i');
        conditions.push({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
            { nric: searchRegex },
            { legacyCustomerNo: searchRegex }
          ]
        });
      }

      // Status filter
      if (statusFilter && statusFilter !== 'all') {
        conditions.push({ status: statusFilter });
      }

      // Membership tier filter
      if (tierFilter && tierFilter !== 'all') {
        conditions.push({ 'memberBenefits.membershipTier': tierFilter });
      }

      const query = conditions.length > 0 ? { $and: conditions } : {};

      // Whitelist sortable fields to prevent injection
      const allowedSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'status'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

      const sortOptions: Record<string, 1 | -1> = {};
      sortOptions[safeSortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;
      const totalCount = await Patient.countDocuments(query);

      const patients = await Patient.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(totalCount / limit);

      return {
        patients,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        }
      };
    } catch (error) {
      console.error('Error in PatientService.getAllPatients:', error);
      throw new Error('Failed to fetch patients');
    }
  }

  // Get patient by ID
  async getPatientById(id: string) {
    if (!isValidObjectId(id)) {
      throw Object.assign(new Error('Invalid patient ID'), { statusCode: 400 });
    }

    const patient = await Patient.findById(id).lean();
    if (!patient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }
    return patient;
  }

  // Create new patient
  async createPatient(patientData: PatientFormData) {
    // Whitelist allowed fields
    const cleanData = pickAllowedFields(patientData as unknown as Record<string, unknown>) as Partial<PatientFormData>;

    // Normalize email and NRIC
    const normalizedEmail = cleanData.email?.trim().toLowerCase();
    const normalizedNric = cleanData.nric?.trim().toUpperCase();
    const hasNric = normalizedNric && normalizedNric.length > 0;

    // Check for duplicate NRIC only (email duplicates are allowed)
    if (hasNric) {
      const existing = await Patient.findOne({ nric: normalizedNric });
      if (existing) {
        throw new Error('Patient with this NRIC already exists');
      }
    }

    if (normalizedEmail) cleanData.email = normalizedEmail;
    if (hasNric) cleanData.nric = normalizedNric;

    const patient = new Patient(cleanData);
    const saved = await patient.save();
    return saved.toJSON();
  }

  // Update patient
  async updatePatient(id: string, updateData: Partial<PatientFormData>) {
    if (!isValidObjectId(id)) {
      throw Object.assign(new Error('Invalid patient ID'), { statusCode: 400 });
    }

    // Whitelist allowed fields
    const cleanData = pickAllowedFields(updateData as unknown as Record<string, unknown>);

    const currentPatient = await Patient.findById(id).lean() as PatientType | null;
    if (!currentPatient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }

    // Normalize email and NRIC
    const normalizedEmail = (cleanData.email as string)?.trim().toLowerCase();
    const normalizedNric = (cleanData.nric as string)?.trim().toUpperCase();
    const currentNric = currentPatient.nric?.trim().toUpperCase();
    const hasNric = normalizedNric && normalizedNric.length > 0;
    const nricIsChanging = hasNric && normalizedNric !== currentNric;

    if (nricIsChanging) {
      const existing = await Patient.findOne({ _id: { $ne: id }, nric: normalizedNric });
      if (existing) {
        throw new Error('Patient with this NRIC already exists');
      }
    }

    if (normalizedEmail && cleanData.email) cleanData.email = normalizedEmail;
    if (hasNric && cleanData.nric) cleanData.nric = normalizedNric;

    // Convert nested objects to dot notation so partial updates don't replace entire subdocuments
    const flattenedUpdate = toDotNotation(cleanData, [
      'memberBenefits', 'marketingPreferences', 'financialSummary', 'enrichmentInfo'
    ]);

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $set: flattenedUpdate },
      { new: true, runValidators: false }
    ).lean();

    if (!patient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }

    return patient;
  }

  // Delete patient (soft-delete by setting status to 'inactive', preserving transaction references)
  async deletePatient(id: string) {
    if (!isValidObjectId(id)) {
      throw Object.assign(new Error('Invalid patient ID'), { statusCode: 400 });
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }

    // Soft delete — set inactive instead of removing, so transactions aren't orphaned
    patient.status = 'inactive';
    await patient.save();

    return { message: 'Patient deactivated successfully' };
  }

  // Permanently delete patient (for bulk operations or explicit permanent removal)
  async permanentlyDeletePatient(id: string) {
    if (!isValidObjectId(id)) {
      throw Object.assign(new Error('Invalid patient ID'), { statusCode: 400 });
    }

    const patient = await Patient.findByIdAndDelete(id);
    if (!patient) {
      throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    }
    return { message: 'Patient deleted permanently' };
  }

  // Get recent patients
  async getRecentPatients(limit: number = 10) {
    return Patient.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  // Bulk delete patients
  async bulkDeletePatients(patientIds: string[]) {
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      throw new Error('Patient IDs array is required');
    }

    // Validate all IDs
    const invalidIds = patientIds.filter(id => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      throw Object.assign(
        new Error(`Invalid patient ID(s): ${invalidIds.join(', ')}`),
        { statusCode: 400 }
      );
    }

    // Soft delete — set inactive instead of hard delete
    const result = await Patient.updateMany(
      { _id: { $in: patientIds } },
      { $set: { status: 'inactive' } }
    );

    return {
      message: `${result.modifiedCount} patients deactivated successfully`,
      deletedCount: result.modifiedCount
    };
  }

  // Get patient statistics
  async getPatientStats() {
    const [totalPatients, activePatients, inactivePatients, withConsent, recentRegistrations] =
      await Promise.all([
        Patient.countDocuments(),
        Patient.countDocuments({ status: 'active' }),
        Patient.countDocuments({ status: 'inactive' }),
        Patient.countDocuments({ hasConsent: true }),
        Patient.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);

    return { totalPatients, activePatients, inactivePatients, withConsent, recentRegistrations };
  }
}
