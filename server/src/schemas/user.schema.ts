import { z } from 'zod';
import { ROLES } from '../config/constants.js';

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid identifier.');

export const idParamSchema = z.object({ id: objectId });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(160)
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[0-9]/, 'Password must contain a digit.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  institution: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  yearOfStudy: z.coerce.number().int().min(1).max(10).optional(),
  batch: z.string().trim().max(60).optional(),
  rollNumber: z.string().trim().max(60).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the AI advice disclaimer to register.' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(25).optional(),
  studentProfile: z
    .object({
      institution: z.string().trim().max(160).optional(),
      department: z.string().trim().max(120).optional(),
      yearOfStudy: z.coerce.number().int().min(1).max(10).optional(),
      rollNumber: z.string().trim().max(60).optional(),
      batch: z.string().trim().max(60).optional(),
      graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
      objective: z.string().trim().max(1000).optional(),
      linkedinUrl: z.string().trim().url('Enter a valid URL.').max(300).optional().or(z.literal('')),
      portfolioUrl: z.string().trim().url('Enter a valid URL.').max(300).optional().or(z.literal('')),
      skillsInterests: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    })
    .optional(),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLES).default('student'),
  phone: z.string().trim().max(25).optional(),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(false),
  assignedCounsellor: objectId.optional(),
  studentProfile: z
    .object({
      institution: z.string().trim().max(160).optional(),
      department: z.string().trim().max(120).optional(),
      yearOfStudy: z.coerce.number().int().min(1).max(10).optional(),
      rollNumber: z.string().trim().max(60).optional(),
      batch: z.string().trim().max(60).optional(),
      objective: z.string().trim().max(1000).optional(),
      skillsInterests: z.array(z.string().trim().max(60)).max(20).optional(),
    })
    .optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(25).optional(),
  role: z.enum(ROLES).optional(),
  assignedCounsellor: objectId.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  studentProfile: z
    .object({
      institution: z.string().trim().max(160).optional(),
      department: z.string().trim().max(120).optional(),
      yearOfStudy: z.coerce.number().int().min(1).max(10).optional(),
      rollNumber: z.string().trim().max(60).optional(),
      batch: z.string().trim().max(60).optional(),
      graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
      objective: z.string().trim().max(1000).optional(),
      linkedinUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
      portfolioUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
      skillsInterests: z.array(z.string().trim().max(60)).max(20).optional(),
    })
    .optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const adminResetPasswordSchema = z.object({
  newPassword: passwordSchema,
  mustChangePassword: z.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
