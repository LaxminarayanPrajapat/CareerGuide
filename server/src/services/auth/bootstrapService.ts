import { env } from '../../config/env.js';
import { UserModel } from '../../models/User.js';
import { hashPassword } from '../../utils/password.js';
import { logger } from '../../utils/logger.js';

/**
 * Creates the first administrator when the users collection is empty.
 *
 * This only runs when there is no administrator at all, so it cannot silently
 * re-create or escalate an account in an existing deployment. If no bootstrap
 * password is configured the account is skipped and a warning is logged.
 */
export async function bootstrapAdmin(): Promise<boolean> {
  const adminCount = await UserModel.countDocuments({ role: 'admin' });
  if (adminCount > 0) return false;

  const { email, password, name } = env.bootstrapAdmin;
  if (!password) {
    logger.warn('auth.bootstrap_skipped', {
      reason: 'BOOTSTRAP_ADMIN_PASSWORD is not set, so no initial administrator was created.',
    });
    return false;
  }

  const existing = await UserModel.findOne({ email });
  if (existing) return false;

  await UserModel.create({
    fullName: name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: 'admin',
    isActive: true,
    mustChangePassword: true,
  });

  logger.warn('auth.bootstrap_admin_created', {
    email,
    note: 'Initial administrator created. Change this password immediately.',
  });
  // eslint-disable-next-line no-console
  console.log(
    `\n  Created initial administrator: ${email}\n  Change this password immediately.\n`,
  );
  return true;
}
